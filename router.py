import time
import asyncio
import json
import importlib
from typing import Dict, Any, Optional, Tuple, Type, List, Callable, AsyncGenerator, Union
from functools import lru_cache
from datetime import datetime, timedelta

from config import get_settings, get_model_registry, Settings, get_fallback_config, ModelCapability
from classifier import get_classifier, PromptClassifier
from cache import get_cache, Cache
from utils.logger import log_prompt_data, get_logger
from models.base_adapter import ModelAdapter

# Import adapters
from models.openai_adapter import OpenAIAdapter
from models.anthropic_adapter import AnthropicAdapter
from models.local_lmstudio_adapter import LocalLMStudioAdapter

logger = get_logger()

# Custom exception classes
class ModelNotAvailableError(Exception):
    """Exception raised when a requested model is not available."""
    pass

class AllModelsFailedError(Exception):
    """Exception raised when all models failed to generate a response."""
    pass

class ModelTimeoutError(Exception):
    """Exception raised when a model request times out."""
    pass

class CapabilityNotSupportedError(Exception):
    """Exception raised when a required capability is not supported by any available model."""
    pass

class ModelRouter:
    """
    Core router for NeuroRoute that manages model selection and prompt routing.
    """
    
    def __init__(
        self, 
        settings: Optional[Settings] = None,
        classifier: Optional[PromptClassifier] = None,
        cache: Optional[Cache] = None
    ):
        """
        Initialize the router and model adapters with dependency injection.
        
        Args:
            settings: Application settings
            classifier: Prompt classifier instance
            cache: Cache instance
        """
        logger.info("Initializing NeuroRoute model router")
        
        # Initialize dependencies with default implementations if not provided
        self.settings = settings or get_settings()
        self.classifier = classifier or get_classifier(self.settings)
        self.cache = cache or get_cache(self.settings)
        self.model_registry = get_model_registry(self.settings)
        self.fallback_config = get_fallback_config(self.settings)
        
        # Initialize model adapters
        self.adapters = {}
        self.model_health = {}  # Track health status of models
        self.model_metrics = {}  # Track performance metrics
        self._initialize_adapters()
        
        # Set up health check background task if enabled
        # Default health check interval if not specified in model config
        self.default_health_check_interval = self.settings.api.health_check_interval
        self.health_check_task = None
        if self.settings.api.enable_model_health_checks and self.settings.api.health_check_interval > 0:
            self._start_health_check_task()
            
        # Capability map for quickly finding models with specific capabilities
        self.capability_model_map = self._build_capability_model_map()
        
        logger.info(f"NeuroRoute router initialized with {len(self.adapters)} model adapters")
    
    @staticmethod
    def _camel_to_snake(name):
        """Converts CamelCase string to snake_case, handling specific cases."""
        import re
        # Handle specific cases that don't follow standard snake_case conversion
        if name == "LocalLMStudioAdapter":
            return "local_lmstudio_adapter"
        if name == "OpenAIAdapter":
            return "openai_adapter"

        # Fallback to standard snake_case conversion for other cases
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

    def _initialize_adapters(self):
        """Initialize all model adapters from the registry using factory pattern."""
        # Static adapter map for backward compatibility
        adapter_map = {
            "openai": OpenAIAdapter,
            "anthropic": AnthropicAdapter,
            "local": LocalLMStudioAdapter,
        }
        
        for model_key, model_config in self.model_registry.items():
            try:
                # First try to get the adapter class from the config
                adapter_class_name = model_config.get("adapter_class")
                adapter_class = None
                
                if adapter_class_name:
                    # Try to dynamically load the adapter class
                    try:
                        # Assume adapters are in models package
                        module = importlib.import_module(f"models.{self._camel_to_snake(adapter_class_name)}")
                        adapter_class = getattr(module, adapter_class_name)
                    except (ImportError, AttributeError) as e:
                        logger.warning(f"Could not dynamically load adapter {adapter_class_name}: {e}")
                        # Fall back to static map
                
                # If dynamic loading failed, use the static map
                if not adapter_class:
                    adapter_class = adapter_map.get(model_key)
                
                if not adapter_class:
                    logger.warning(f"Unknown model type: {model_key}, skipping")
                    continue
                
                # Initialize the adapter with model config
                self.adapters[model_key] = adapter_class(model_config)
                
                # Initialize health and metrics tracking
                self.model_health[model_key] = {
                    "status": "unknown",
                    "last_checked": None,
                    "error": None,
                    "next_check_time": time.time() + model_config.get("health_check_interval", self.settings.api.health_check_interval)
                }
                self.model_metrics[model_key] = {
                    "requests": 0,
                    "successes": 0,
                    "failures": 0,
                    "avg_latency_ms": 0,
                    "total_tokens_processed": 0,
                    "total_tokens_input": 0,
                    "total_tokens_output": 0,
                    "total_cost": 0.0,
                    "last_reset": time.time(),
                    "timeout_count": 0,
                    "cache_hit_count": 0,
                    "stream_requests": 0
                }
                
                logger.info(f"Initialized adapter for {model_key} ({model_config.get('name', 'unnamed')})")
            except Exception as e:
                logger.error(f"Failed to initialize adapter for {model_key}: {e}")
                self.model_health[model_key] = {
                    "status": "error",
                    "last_checked": datetime.now().isoformat(),
                    "error": str(e)
                }
    
    def _build_capability_model_map(self) -> Dict[str, List[str]]:
        """
        Build a map of capabilities to models that support them.
        This allows for fast lookup of models by capability.
        
        Returns:
            Dict mapping capability names to lists of model keys
        """
        capability_map = {}
        
        for model_key, model_config in self.model_registry.items():
            capabilities = model_config.get("capabilities", [])
            
            for capability in capabilities:
                if capability not in capability_map:
                    capability_map[capability] = []
                capability_map[capability].append(model_key)
                
        return capability_map
    
    def _start_health_check_task(self):
        """Start background task to periodically check model health."""
        async def _health_check_loop():
            while True:
                try:
                    # Check if any models need health checks
                    current_time = time.time()
                    models_to_check = []
                    
                    for model_key, health in self.model_health.items():
                        next_check_time = health.get("next_check_time", 0)
                        if current_time >= next_check_time:
                            models_to_check.append(model_key)
                    
                    if models_to_check:
                        logger.debug(f"Running health check for models: {', '.join(models_to_check)}")
                        await self._check_models_health(models_to_check)
                    
                    # Sleep for a shorter interval to be responsive
                    await asyncio.sleep(10)  # Check every 10 seconds if any models need health checks
                except Exception as e:
                    logger.error(f"Error in health check loop: {e}")
                    await asyncio.sleep(60)  # Wait a minute on error
        
        loop = asyncio.get_event_loop()
        self.health_check_task = loop.create_task(_health_check_loop())
        logger.info("Started model health check background task")
    
    async def _check_models_health(self, model_keys: List[str]):
        """
        Check health status of specific model adapters.
        
        Args:
            model_keys: List of model keys to check
        """
        for model_key in model_keys:
            if model_key not in self.adapters:
                continue
                
            try:
                adapter = self.adapters[model_key]
                model_config = self.model_registry.get(model_key, {})
                health_check_interval = model_config.get("health_check_interval", self.settings.api.health_check_interval)
                
                # Check if adapter has a health check method
                if hasattr(adapter, "check_health") and callable(getattr(adapter, "check_health")):
                    health_info = await adapter.check_health()
                    self.model_health[model_key] = {
                        "status": health_info.get("status", "unknown"),
                        "last_checked": datetime.now().isoformat(),
                        "error": health_info.get("message", None) if health_info.get("status") != "healthy" else None,
                        "details": health_info.get("details", {}),
                        "next_check_time": time.time() + health_check_interval
                    }
                else:
                    # For adapters without a health check, use a simple ping
                    test_prompt = "Hello, are you working? This is a health check."
                    try:
                        result = await adapter.generate_response(test_prompt, {"health_check": True})
                        self.model_health[model_key] = {
                            "status": "healthy",
                            "last_checked": datetime.now().isoformat(),
                            "error": None,
                            "latency_ms": result.get("latency_ms", 0),
                            "next_check_time": time.time() + health_check_interval
                        }
                    except Exception as e:
                        self.model_health[model_key] = {
                            "status": "unhealthy",
                            "last_checked": datetime.now().isoformat(),
                            "error": f"Health check ping failed: {str(e)}",
                            "next_check_time": time.time() + min(health_check_interval, 60)  # Check more frequently when unhealthy
                        }
            except Exception as e:
                logger.warning(f"Health check failed for {model_key}: {e}")
                self.model_health[model_key] = {
                    "status": "unhealthy",
                    "last_checked": datetime.now().isoformat(),
                    "error": str(e),
                    "next_check_time": time.time() + 60  # Check again in a minute when error
                }
    
    async def _check_all_models_health(self):
        """Check health status of all model adapters."""
        await self._check_models_health(list(self.adapters.keys()))
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """
        Get information about all available models with their current status.
        
        Returns:
            List of model information dictionaries
        """
        models = []
        for model_key, adapter in self.adapters.items():
            model_config = self.model_registry.get(model_key, {})
            model_info = {
                "id": model_key,
                "name": model_config.get("name", "Unknown"),
                "provider": model_config.get("provider", "Unknown"),
                "capabilities": model_config.get("capabilities", []),
                "avg_latency_ms": model_config.get("avg_latency_ms", 0),
                "cost_per_1k_tokens": model_config.get("cost_per_1k_tokens", 0),
                "max_tokens": model_config.get("max_tokens", 0),
                "supports_streaming": model_config.get("supports_streaming", False),
                "description": model_config.get("description", ""),
                "health": self.model_health.get(model_key, {"status": "unknown"}),
                "metrics": {
                    "requests": self.model_metrics[model_key]["requests"],
                    "success_rate": self._calculate_success_rate(model_key),
                    "avg_latency_ms": self.model_metrics[model_key]["avg_latency_ms"],
                    "total_tokens_processed": self.model_metrics[model_key]["total_tokens_processed"],
                    "estimated_cost": self._calculate_cost(model_key),
                }
            }
            models.append(model_info)
        return models
    
    def _calculate_success_rate(self, model_key: str) -> float:
        """Calculate success rate for a model."""
        metrics = self.model_metrics[model_key]
        total = metrics["successes"] + metrics["failures"]
        return round((metrics["successes"] / max(total, 1)) * 100, 2)
    
    def _calculate_cost(self, model_key: str) -> float:
        """Calculate estimated cost for a model based on token usage."""
        metrics = self.model_metrics[model_key]
        model_config = self.model_registry.get(model_key, {})
        cost_per_1k_tokens = model_config.get("cost_per_1k_tokens", 0)
        
        # If the adapter tracks cost directly
        if metrics.get("total_cost", 0) > 0:
            return metrics["total_cost"]
            
        # Otherwise estimate from token count
        total_tokens = metrics["total_tokens_processed"]
        if total_tokens == 0:
            return 0.0
            
        # Convert cost_per_1k_tokens to cost per token and multiply
        return round((cost_per_1k_tokens / 1000) * total_tokens, 4)
    
    def _update_metrics(self, model_key: str, success: bool, latency_ms: int, tokens: int = 0, 
                       input_tokens: int = 0, output_tokens: int = 0, cost: float = 0.0, 
                       from_cache: bool = False, is_streaming: bool = False):
        """
        Update usage metrics for a model.
        
        Args:
            model_key: The model identifier
            success: Whether the request was successful
            latency_ms: Request latency in milliseconds
            tokens: Total tokens processed (if not providing input/output separately)
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            cost: Direct cost if provided by the model adapter
            from_cache: Whether this was a cache hit
            is_streaming: Whether this was a streaming request
        """
        if model_key not in self.model_metrics:
            return
            
        metrics = self.model_metrics[model_key]
        metrics["requests"] += 1
        
        if success:
            metrics["successes"] += 1
        else:
            metrics["failures"] += 1
            
        # Update rolling average latency (only for successful non-cached requests)
        if success and not from_cache and latency_ms > 0:
            prev_avg = metrics["avg_latency_ms"]
            prev_count = metrics["successes"] - 1  # Subtract current success
            if prev_count <= 0:
                metrics["avg_latency_ms"] = latency_ms
            else:
                metrics["avg_latency_ms"] = (prev_avg * prev_count + latency_ms) / (prev_count + 1)
            
        # Update token counts
        if tokens > 0:
            metrics["total_tokens_processed"] += tokens
        
        # Update separate input/output token counts if provided
        if input_tokens > 0:
            metrics["total_tokens_input"] += input_tokens
        
        if output_tokens > 0:
            metrics["total_tokens_output"] += output_tokens
            
        # Update direct cost if provided
        if cost > 0:
            metrics["total_cost"] += cost
            
        # Track cache hits
        if from_cache:
            metrics["cache_hit_count"] += 1
            
        # Track streaming requests
        if is_streaming:
            metrics["stream_requests"] += 1
            
        # Reset metrics daily if needed
        now = time.time()
        if now - metrics["last_reset"] > 86400:  # 24 hours
            logger.info(f"Resetting metrics for {model_key}")
            metrics["last_reset"] = now
            # Keep request counts but reset averages
            metrics["avg_latency_ms"] = 0
    
    def _get_fallback_model_order(self, primary_model: str) -> List[str]:
        """
        Determine the order of fallback models to try if the primary model fails.
        Uses the fallback configuration from settings.
        
        Args:
            primary_model: The model that failed
            
        Returns:
            List of model keys to try in order
        """
        # Check if we have a configured fallback order for this model
        if self.fallback_config.enabled and primary_model in self.fallback_config.fallback_order:
            fallback_models = self.fallback_config.fallback_order.get(primary_model, [])
        else:
            # Default order preference, adjusted based on primary model
            fallback_models = ["openai", "anthropic", "local"]
            
            # Move the primary model to the end if it's in the list
            if primary_model in fallback_models:
                fallback_models.remove(primary_model)
                fallback_models.append(primary_model)
        
        # Filter to only include available adapters
        return [m for m in fallback_models if m in self.adapters]
    
    def _find_models_with_capability(self, capability: str, exclude_models: List[str] = None) -> List[str]:
        """
        Find models that support a specific capability.
        
        Args:
            capability: The capability to look for
            exclude_models: Models to exclude from results
            
        Returns:
            List of model keys with the capability
        """
        if exclude_models is None:
            exclude_models = []
            
        models = self.capability_model_map.get(capability, [])
        return [m for m in models if m in self.adapters and m not in exclude_models]
    
    async def route_prompt(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main method to route a prompt to the appropriate model.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Returns:
            The model response with metadata
        """
        if metadata is None:
            metadata = {}
            
        request_id = metadata.get("request_id", f"req_{int(time.time() * 1000)}")
        start_time = time.time()
        
        # Add request ID to logs for traceability
        logger.info(f"[{request_id}] Processing prompt (length: {len(prompt)})")
        
        # Step 1: Check cache if caching is enabled
        use_cache = metadata.get("use_cache", self.settings.redis.cache_responses)
        if use_cache:
            cached_response = await self.cache.get(prompt, metadata)
            if cached_response:
                logger.info(f"[{request_id}] Using cached response")
                # Update response with current latency
                cache_latency_ms = int((time.time() - start_time) * 1000)
                cached_response["cache_latency_ms"] = cache_latency_ms
                cached_response["from_cache"] = True
                
                # Update metrics for the model that was cached
                model_key = cached_response.get("model_used")
                if model_key in self.model_metrics:
                    self._update_metrics(
                        model_key, 
                        True, 
                        cache_latency_ms, 
                        tokens=sum(cached_response.get("token_usage", {}).values()),
                        from_cache=True
                    )
                
                # Log the cached response
                log_data = {
                    "request_id": request_id,
                    "timestamp": time.time(),
                    "prompt": prompt,
                    "metadata": metadata,
                    "from_cache": True,
                    "model_used": cached_response["model_used"],
                    "latency_ms": cache_latency_ms,
                    "token_usage": cached_response.get("token_usage", {}),
                }
                # Make this awaitable for FastAPI background tasks
                await log_prompt_data(log_data, self.settings)
                
                return cached_response
            
        # Step 2: Apply any preprocessing to the prompt if needed
        processed_prompt = await self._preprocess_prompt(prompt, metadata)
        
        # Check for capability requirements in metadata
        required_capabilities = metadata.get("required_capabilities", [])
        
        # Step 3: Determine model selection approach
        if required_capabilities:
            # If specific capabilities are required, use capability-based routing
            model_key = await self._select_model_by_capabilities(required_capabilities, prompt, metadata)
            classification_info = {
                "selection_method": "capability_based",
                "required_capabilities": required_capabilities,
                "selected_model": model_key
            }
        elif "model" in metadata:
            # If model is specified directly in metadata
            requested_model = metadata["model"]
            if requested_model in self.adapters:
                model_key = requested_model
                classification_info = {
                    "selection_method": "user_specified",
                    "selected_model": model_key
                }
            else:
                # Fall back to classification if requested model is not available
                logger.warning(f"[{request_id}] User requested model '{requested_model}' not available, using classification")
                model_key, classification_info = await self.classifier.classify_prompt_async(processed_prompt, metadata)
                classification_info["selection_method"] = "fallback_classification"
        else:
            # Default to classifier-based routing
            model_key, classification_info = await self.classifier.classify_prompt_async(processed_prompt, metadata)
            classification_info["selection_method"] = "classifier"
        
        # Check if the model is healthy before continuing
        if model_key in self.model_health and self.model_health[model_key].get("status") == "unhealthy":
            logger.warning(f"[{request_id}] Selected model {model_key} is unhealthy, finding alternative")
            # Find a healthy alternative
            for alt_model in self._get_fallback_model_order(model_key):
                if alt_model in self.model_health and self.model_health[alt_model].get("status") != "unhealthy":
                    logger.info(f"[{request_id}] Using healthy alternative: {alt_model}")
                    model_key = alt_model
                    classification_info["health_fallback"] = True
                    classification_info["original_model"] = model_key
                    break
        
        # Step 4: Check if the selected model adapter is available
        if model_key not in self.adapters:
            logger.warning(f"[{request_id}] Selected model {model_key} not available, falling back to default")
            fallback_models = self._get_fallback_model_order(model_key)
            
            if not fallback_models:
                logger.error(f"[{request_id}] No model adapters available")
                return {
                    "model_used": "none",
                    "response": "Error: No model adapters available",
                    "error": True,
                    "request_id": request_id,
                    "latency_ms": int((time.time() - start_time) * 1000)
                }
            
            model_key = fallback_models[0]
            classification_info["fallback_reason"] = "Selected model adapter not available"
            classification_info["original_model"] = model_key
        
        # Step 5: Check for streaming request
        if metadata.get("stream", False) and self.model_registry.get(model_key, {}).get("supports_streaming", False):
            # Handle streaming response differently - return an async generator
            return await self._handle_streaming_request(model_key, processed_prompt, metadata, request_id, classification_info)
        
        # Step 6: Generate response using selected model
        logger.info(f"[{request_id}] Routing prompt to {model_key} model")
        
        try:
            # Update metrics - count the request
            self._update_metrics(model_key, False, 0, 0)  # Will update success later
            
            # Set timeout if provided in metadata
            timeout = metadata.get("timeout", self.settings.api.default_request_timeout)
            
            # Create a timeout-protected task
            try:
                if timeout and timeout > 0:
                    response_task = asyncio.create_task(
                        self.adapters[model_key].generate_response(processed_prompt, metadata)
                    )
                    response = await asyncio.wait_for(response_task, timeout=timeout)
                else:
                    response = await self.adapters[model_key].generate_response(processed_prompt, metadata)
            except asyncio.TimeoutError:
                logger.warning(f"[{request_id}] Request to {model_key} timed out after {timeout}s")
                # Update metrics for timeout
                self._update_metrics(model_key, False, int((time.time() - start_time) * 1000), 0)
                self.model_metrics[model_key]["timeout_count"] += 1
                raise ModelTimeoutError(f"Request timed out after {timeout}s")
            
            # Extract token usage info
            token_usage = response.get("token_usage", {})
            input_tokens = token_usage.get("prompt_tokens", 0)
            output_tokens = token_usage.get("completion_tokens", 0)
            total_tokens = token_usage.get("total_tokens", input_tokens + output_tokens)
            
            # Update metrics - successful request
            self._update_metrics(
                model_key, 
                True, 
                response.get("latency_ms", 0), 
                tokens=total_tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=response.get("cost", 0.0)
            )
            
            # Add metadata to response
            response["classification"] = classification_info
            response["model_used"] = model_key
            response["request_id"] = request_id
            response["from_cache"] = False
            
            # Step 7: Cache the response if caching is enabled
            if use_cache:
                await self.cache.set(prompt, response, metadata)
            
            # Step 8: Log request and response data
            log_data = {
                "request_id": request_id,
                "timestamp": time.time(),
                "prompt": prompt,
                "metadata": metadata,
                "from_cache": False,
                "model_used": model_key,
                "latency_ms": response["latency_ms"],
                "token_usage": response.get("token_usage", {}),
                "classification_info": classification_info
            }
            # Make this awaitable for FastAPI background tasks
            await log_prompt_data(log_data, self.settings)
            
            return response
            
        except (ModelTimeoutError, asyncio.TimeoutError) as timeout_err:
            # Handle timeouts - they might be common enough to warrant special handling
            error_message = f"Request timed out after {timeout}s"
            error_type = "timeout"
            
            # Try fallback if enabled for timeouts
            if self.fallback_config.retry_on_timeout:
                return await self._handle_fallback(model_key, processed_prompt, metadata, request_id, 
                                                 classification_info, error_message, timeout_err, start_time)
            else:
                # Return timeout error without fallback
                total_latency = int((time.time() - start_time) * 1000)
                error_response = {
                    "model_used": model_key,
                    "response": f"Error: {error_message}",
                    "error": True,
                    "error_type": error_type,
                    "request_id": request_id,
                    "latency_ms": total_latency
                }
                
                # Log the timeout
                log_data = {
                    "request_id": request_id,
                    "timestamp": time.time(),
                    "prompt": prompt,
                    "metadata": metadata,
                    "error": True,
                    "error_type": error_type,
                    "error_message": error_message,
                    "model_used": model_key,
                    "latency_ms": total_latency
                }
                await log_prompt_data(log_data, self.settings)
                
                return error_response
            
        except Exception as e:
            # Update metrics - failed request
            self._update_metrics(
                model_key, 
                False, 
                int((time.time() - start_time) * 1000),
                0
            )
            
            logger.error(f"[{request_id}] Error generating response with {model_key}: {e}")
            
            # Determine error type for more specific handling
            error_type = "unknown"
            if "rate limit" in str(e).lower():
                error_type = "rate_limit"
            elif "server error" in str(e).lower() or "5" in str(e).lower():
                error_type = "server_error"
            
            # Check fallback configuration
            should_fallback = (
                self.fallback_config.enabled and (
                    (error_type == "rate_limit" and self.fallback_config.retry_on_rate_limit) or
                    (error_type == "server_error" and self.fallback_config.retry_on_server_error) or
                    # For unknown errors, we'll try fallback by default
                    error_type == "unknown"
                )
            )
            
            if should_fallback:
                return await self._handle_fallback(model_key, processed_prompt, metadata, request_id, 
                                                 classification_info, str(e), e, start_time)
            else:
                # Return error without fallback
                total_latency = int((time.time() - start_time) * 1000)
                error_response = {
                    "model_used": model_key,
                    "response": f"Error: {str(e)}",
                    "error": True,
                    "error_type": error_type,
                    "request_id": request_id,
                    "latency_ms": total_latency
                }
                
                # Log the error
                log_data = {
                    "request_id": request_id,
                    "timestamp": time.time(),
                    "prompt": prompt,
                    "metadata": metadata,
                    "error": True,
                    "error_type": error_type,
                    "error_message": str(e),
                    "model_used": model_key,
                    "latency_ms": total_latency
                }
                await log_prompt_data(log_data, self.settings)
                
                return error_response
    
    async def _handle_fallback(self, primary_model: str, prompt: str, metadata: Dict[str, Any], 
                             request_id: str, classification_info: Dict[str, Any], 
                             error_message: str, original_error: Exception, start_time: float) -> Dict[str, Any]:
        """
        Handle fallback to alternative models when the primary model fails.
        
        Args:
            primary_model: The model key that failed
            prompt: The processed prompt
            metadata: Request metadata
            request_id: Unique request identifier
            classification_info: Classification information
            error_message: Error message from the primary model
            original_error: Original exception
            start_time: Request start time
            
        Returns:
            Response from a fallback model or error response
        """
        # Attempt fallback if primary model fails
        fallback_models = self._get_fallback_model_order(primary_model)
        max_retries = self.fallback_config.max_retries
        
        for fallback_model in fallback_models[:max_retries]:
            if fallback_model == primary_model:
                continue  # Skip the original model that failed
                
            try:
                logger.info(f"[{request_id}] Falling back to {fallback_model} model")
                
                # Update metrics - count the fallback request
                self._update_metrics(fallback_model, False, 0, 0)
                
                # Set timeout if provided in metadata
                timeout = metadata.get("timeout", self.settings.api.default_request_timeout)
                
                # Try the fallback model with timeout protection
                if timeout and timeout > 0:
                    response_task = asyncio.create_task(
                        self.adapters[fallback_model].generate_response(prompt, metadata)
                    )
                    response = await asyncio.wait_for(response_task, timeout=timeout)
                else:
                    response = await self.adapters[fallback_model].generate_response(prompt, metadata)
                
                # Extract token usage info
                token_usage = response.get("token_usage", {})
                input_tokens = token_usage.get("prompt_tokens", 0)
                output_tokens = token_usage.get("completion_tokens", 0)
                total_tokens = token_usage.get("total_tokens", input_tokens + output_tokens)
                
                # Update metrics - successful fallback
                self._update_metrics(
                    fallback_model, 
                    True, 
                    response.get("latency_ms", 0),
                    tokens=total_tokens,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=response.get("cost", 0.0)
                )
                
                # Add fallback info to response
                response["model_used"] = fallback_model
                response["fallback"] = True
                response["fallback_reason"] = f"Primary model ({primary_model}) failed: {error_message}"
                response["request_id"] = request_id
                response["from_cache"] = False
                response["classification"] = classification_info
                
                # Cache the fallback response if caching is enabled
                if metadata.get("use_cache", self.settings.redis.cache_responses):
                    await self.cache.set(prompt, response, metadata)
                
                # Log the fallback
                log_data = {
                    "request_id": request_id,
                    "timestamp": time.time(),
                    "prompt": prompt,
                    "metadata": metadata,
                    "from_cache": False,
                    "model_used": fallback_model,
                    "fallback": True,
                    "original_model": primary_model,
                    "error": str(original_error),
                    "latency_ms": response["latency_ms"],
                    "token_usage": response.get("token_usage", {}),
                }
                await log_prompt_data(log_data, self.settings)
                
                return response
            except Exception as fallback_error:
                # Update metrics - failed fallback
                self._update_metrics(
                    fallback_model,
                    False,
                    int((time.time() - start_time) * 1000),
                    0
                )
                
                logger.error(f"[{request_id}] Fallback to {fallback_model} also failed: {fallback_error}")
                continue
        
        # Return error response if all else fails
        total_latency = int((time.time() - start_time) * 1000)
        error_response = {
            "model_used": "none",
            "response": f"Error: All models failed. Original error: {error_message}",
            "error": True,
            "request_id": request_id,
            "latency_ms": total_latency,
            "attempts": [primary_model] + [m for m in fallback_models if m != primary_model][:max_retries]
        }
        
        # Log the complete failure
        log_data = {
            "request_id": request_id,
            "timestamp": time.time(),
            "prompt": prompt,
            "metadata": metadata,
            "error": True,
            "error_message": error_message,
            "attempts": [primary_model] + [m for m in fallback_models if m != primary_model][:max_retries],
            "latency_ms": total_latency
        }
        await log_prompt_data(log_data, self.settings)
        
        return error_response
    
    async def _handle_streaming_request(self, model_key: str, prompt: str, metadata: Dict[str, Any], 
                                      request_id: str, classification_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a streaming request to an LLM model.
        
        Args:
            model_key: The model to use
            prompt: The processed prompt
            metadata: Request metadata
            request_id: Unique request identifier
            classification_info: Classification information
            
        Returns:
            Dict with streaming response information
        """
        start_time = time.time()
        logger.info(f"[{request_id}] Initiating streaming request to {model_key}")
        
        try:
            # Update metrics - count the streaming request
            self._update_metrics(model_key, False, 0, 0, is_streaming=True)
            
            # Check if the adapter supports streaming
            if not hasattr(self.adapters[model_key], "generate_stream"):
                error_msg = f"Model {model_key} does not support streaming"
                logger.warning(f"[{request_id}] {error_msg}")
                return {
                    "model_used": model_key,
                    "response": f"Error: {error_msg}",
                    "error": True,
                    "request_id": request_id,
                    "latency_ms": int((time.time() - start_time) * 1000)
                }
            
            # Get the stream generator and metadata
            stream_gen, stream_meta = await self.adapters[model_key].generate_stream(prompt, metadata)
            
            # Update metrics with successful stream initialization
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Prepare the response - the actual content will be streamed
            response = {
                "model_used": model_key,
                "stream": True,
                "request_id": request_id,
                "from_cache": False,
                "classification": classification_info,
                "stream_generator": stream_gen,  # This will be consumed by the API endpoint
                "init_latency_ms": latency_ms,
                "stream_meta": stream_meta
            }
            
            # Log the streaming request
            log_data = {
                "request_id": request_id,
                "timestamp": time.time(),
                "prompt": prompt,
                "metadata": metadata,
                "from_cache": False,
                "model_used": model_key,
                "streaming": True,
                "init_latency_ms": latency_ms,
                "classification_info": classification_info
            }
            await log_prompt_data(log_data, self.settings)
            
            # The metrics will be fully updated when the stream completes
            # This happens in the API layer after the streaming completes
            
            return response
            
        except Exception as e:
            # Update metrics - failed streaming request
            self._update_metrics(
                model_key, 
                False, 
                int((time.time() - start_time) * 1000),
                0,
                is_streaming=True
            )
            
            logger.error(f"[{request_id}] Error initializing stream from {model_key}: {e}")
            
            # Try fallback if enabled
            if self.fallback_config.enabled:
                # For streaming, we need to find models that support streaming
                fallback_models = [
                    m for m in self._get_fallback_model_order(model_key)
                    if m in self.adapters and 
                    m != model_key and
                    self.model_registry.get(m, {}).get("supports_streaming", False)
                ]
                
                for fallback_model in fallback_models[:self.fallback_config.max_retries]:
                    try:
                        logger.info(f"[{request_id}] Falling back to {fallback_model} for streaming")
                        
                        # Try the fallback model
                        if hasattr(self.adapters[fallback_model], "generate_stream"):
                            fallback_stream_gen, fallback_meta = await self.adapters[fallback_model].generate_stream(prompt, metadata)
                            
                            # Prepare the fallback response
                            fallback_latency = int((time.time() - start_time) * 1000)
                            fallback_response = {
                                "model_used": fallback_model,
                                "stream": True,
                                "fallback": True,
                                "fallback_reason": f"Primary model ({model_key}) failed: {str(e)}",
                                "request_id": request_id,
                                "from_cache": False,
                                "classification": classification_info,
                                "stream_generator": fallback_stream_gen,
                                "init_latency_ms": fallback_latency,
                                "stream_meta": fallback_meta
                            }
                            
                            # Log the fallback streaming
                            log_data = {
                                "request_id": request_id,
                                "timestamp": time.time(),
                                "prompt": prompt,
                                "metadata": metadata,
                                "from_cache": False,
                                "model_used": fallback_model,
                                "streaming": True,
                                "fallback": True,
                                "original_model": model_key,
                                "error": str(e),
                                "init_latency_ms": fallback_latency
                            }
                            await log_prompt_data(log_data, self.settings)
                            
                            return fallback_response
                        else:
                            logger.warning(f"[{request_id}] Fallback model {fallback_model} does not support streaming")
                            continue
                    except Exception as fallback_error:
                        logger.error(f"[{request_id}] Fallback to {fallback_model} for streaming failed: {fallback_error}")
                        continue
            
            # Return error response if all else fails
            total_latency = int((time.time() - start_time) * 1000)
            error_response = {
                "model_used": model_key,
                "response": f"Error initializing stream: {str(e)}",
                "error": True,
                "request_id": request_id,
                "latency_ms": total_latency,
                "stream": False
            }
            
            # Log the streaming failure
            log_data = {
                "request_id": request_id,
                "timestamp": time.time(),
                "prompt": prompt,
                "metadata": metadata,
                "error": True,
                "error_message": str(e),
                "model_used": model_key,
                "streaming": True,
                "stream_error": True,
                "latency_ms": total_latency
            }
            await log_prompt_data(log_data, self.settings)
            
            return error_response
    
    async def _preprocess_prompt(self, prompt: str, metadata: Dict[str, Any]) -> str:
        """
        Apply any necessary preprocessing to the prompt before routing.
        
        Args:
            prompt: The original prompt
            metadata: Request metadata
            
        Returns:
            Processed prompt
        """
        # For now, this is a simple pass-through, but could be expanded
        # to include sanitization, truncation, formatting, etc.
        
        # Check for max prompt length in settings
        max_length = self.settings.api.max_prompt_length
        if max_length > 0 and len(prompt) > max_length:
            logger.warning(f"Prompt exceeds maximum length of {max_length}, truncating")
            prompt = prompt[:max_length]
        
        # Sanitize the prompt if enabled (remove potentially harmful content)
        # This would be a good place to add any security filtering
        
        return prompt
    
    async def _select_model_by_capabilities(self, required_capabilities: List[str], 
                                         prompt: str, metadata: Dict[str, Any]) -> str:
        """
        Select a model based on the required capabilities.
        
        Args:
            required_capabilities: List of required capabilities
            prompt: The user prompt (for fallback to classifier if needed)
            metadata: Request metadata
            
        Returns:
            Selected model key
        """
        logger.info(f"Selecting model based on capabilities: {required_capabilities}")
        
        if not required_capabilities:
            # Fall back to classifier if no capabilities specified
            model_key, _ = await self.classifier.classify_prompt_async(prompt, metadata)
            return model_key
        
        # Find models that support all required capabilities
        candidate_models = []
        for model_key, model_info in self.model_registry.items():
            if model_key not in self.adapters:
                continue
                
            capabilities = set(model_info.get("capabilities", []))
            required = set(required_capabilities)
            
            if required.issubset(capabilities):
                # Model supports all required capabilities
                candidate_models.append(model_key)
        
        if not candidate_models:
            logger.warning(f"No models found supporting all required capabilities: {required_capabilities}")
            
            # Try to find a model that supports at least one of the capabilities
            for model_key, model_info in self.model_registry.items():
                if model_key not in self.adapters:
                    continue
                    
                capabilities = set(model_info.get("capabilities", []))
                required = set(required_capabilities)
                
                if required.intersection(capabilities):
                    # Model supports at least one required capability
                    candidate_models.append(model_key)
            
            if not candidate_models:
                # Fall back to classifier if still no matching models
                logger.warning("Falling back to classifier due to no capability matches")
                model_key, _ = await self.classifier.classify_prompt_async(prompt, metadata)
                return model_key
        
        # If multiple models match, use priority settings to decide
        # We'll check if there's a priority specified in metadata
        priority = metadata.get("priority", "quality")
        
        if priority == "speed":
            # Sort by speed priority (lower is faster)
            sorted_models = sorted(
                candidate_models,
                key=lambda m: self.model_registry.get(m, {}).get("priority", {}).get("speed", 2)
            )
        elif priority == "cost":
            # Sort by cost priority (lower is cheaper)
            sorted_models = sorted(
                candidate_models,
                key=lambda m: self.model_registry.get(m, {}).get("priority", {}).get("cost", 2)
            )
        else:  # Default to quality
            # Sort by quality priority (lower is higher quality)
            sorted_models = sorted(
                candidate_models,
                key=lambda m: self.model_registry.get(m, {}).get("priority", {}).get("quality", 2)
            )
        
        if sorted_models:
            # Return the best match
            return sorted_models[0]
        else:
            # This shouldn't happen, but fallback to classifier just in case
            model_key, _ = await self.classifier.classify_prompt_async(prompt, metadata)
            return model_key
    
    async def test_model(self, model_key: str, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Test a specific model directly, bypassing the routing logic.
        
        Args:
            model_key: The model key to test
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Returns:
            The model response with metadata
        """
        if model_key not in self.adapters:
            raise ModelNotAvailableError(f"Model {model_key} not available")
            
        if metadata is None:
            metadata = {}
            
        # Add test mode flag to metadata
        metadata["test_mode"] = True
        request_id = metadata.get("request_id", f"test_{int(time.time() * 1000)}")
        
        try:
            # Update metrics - count the test request
            self._update_metrics(model_key, False, 0, 0)
            
            # Check if this is a streaming test
            if metadata.get("stream", False) and self.model_registry.get(model_key, {}).get("supports_streaming", False):
                # Handle streaming test
                if hasattr(self.adapters[model_key], "generate_stream"):
                    start_time = time.time()
                    stream_gen, stream_meta = await self.adapters[model_key].generate_stream(prompt, metadata)
                    latency_ms = int((time.time() - start_time) * 1000)
                    
                    return {
                        "model_used": model_key,
                        "stream": True,
                        "test_mode": True,
                        "request_id": request_id,
                        "stream_generator": stream_gen,
                        "init_latency_ms": latency_ms,
                        "stream_meta": stream_meta
                    }
                else:
                    return {
                        "model_used": model_key,
                        "response": f"Error: Model {model_key} does not support streaming",
                        "error": True,
                        "test_mode": True,
                        "request_id": request_id,
                        "latency_ms": 0
                    }
            
            # Standard non-streaming test
            response = await self.adapters[model_key].generate_response(prompt, metadata)
            
            # Update metrics - successful test
            token_count = sum(response.get("token_usage", {}).values())
            self._update_metrics(
                model_key, 
                True, 
                response.get("latency_ms", 0),
                tokens=token_count,
                input_tokens=response.get("token_usage", {}).get("prompt_tokens", 0),
                output_tokens=response.get("token_usage", {}).get("completion_tokens", 0),
                cost=response.get("cost", 0.0)
            )
            
            response["model_used"] = model_key
            response["test_mode"] = True
            response["request_id"] = request_id
            
            # Log the test request
            log_data = {
                "request_id": request_id,
                "timestamp": time.time(),
                "prompt": prompt,
                "metadata": metadata,
                "from_cache": False,
                "model_used": model_key,
                "test_mode": True,
                "latency_ms": response["latency_ms"],
                "token_usage": response.get("token_usage", {}),
            }
            await log_prompt_data(log_data, self.settings)
            
            return response
        except Exception as e:
            # Update metrics - failed test
            self._update_metrics(model_key, False, 0, 0)
            
            logger.error(f"Error testing model {model_key}: {e}")
            return {
                "model_used": model_key,
                "response": f"Error: {str(e)}",
                "error": True,
                "test_mode": True,
                "request_id": request_id,
                "latency_ms": 0
            }

    async def get_health_status(self) -> Dict[str, Any]:
        """
        Get health status for all models.
        
        Returns:
            Dict with health information for all models
        """
        # Force a health check if needed
        await self._check_all_models_health()
        
        # Calculate overall system status
        healthy_models = sum(1 for h in self.model_health.values() if h.get("status") == "healthy")
        total_models = len(self.model_health)
        overall_status = "healthy" if healthy_models > 0 else "unhealthy"
        
        return {
            "status": overall_status,
            "timestamp": datetime.now().isoformat(),
            "healthy_models": healthy_models,
            "total_models": total_models,
            "models": self.model_health,
            "metrics": {model: {
                "requests": metrics["requests"],
                "success_rate": self._calculate_success_rate(model),
                "avg_latency_ms": metrics["avg_latency_ms"],
                "total_tokens": metrics["total_tokens_processed"],
                "estimated_cost": self._calculate_cost(model),
                "cache_hit_rate": (metrics["cache_hit_count"] / max(metrics["requests"], 1) * 100),
                "stream_requests": metrics["stream_requests"],
                "timeout_count": metrics.get("timeout_count", 0)
            } for model, metrics in self.model_metrics.items()}
        }

    async def close(self):
        """Close all resources used by the router."""
        try:
            # Cancel health check task if running
            if self.health_check_task:
                self.health_check_task.cancel()
                try:
                    await self.health_check_task
                except asyncio.CancelledError:
                    pass
            
            # Close any adapter resources
            for model_key, adapter in self.adapters.items():
                if hasattr(adapter, "close") and callable(getattr(adapter, "close")):
                    try:
                        await adapter.close()
                    except Exception as e:
                        logger.warning(f"Error closing adapter {model_key}: {e}")
            
            # Close cache
            if self.cache:
                await self.cache.close()
                
            logger.info("Successfully closed router resources")
        except Exception as e:
            logger.error(f"Error closing router resources: {e}")


# Factory function with caching for better performance
def get_router(
    settings: Optional[Settings] = None,
    classifier: Optional[PromptClassifier] = None,
    cache: Optional[Cache] = None
) -> ModelRouter:
    """
    Factory function to create or return cached ModelRouter instance.
    
    Args:
        settings: Optional settings to initialize router with
        classifier: Optional classifier instance
        cache: Optional cache instance
        
    Returns:
        ModelRouter instance
    """
    return ModelRouter(settings, classifier, cache)