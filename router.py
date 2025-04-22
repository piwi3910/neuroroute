import time
from typing import Dict, Any, Optional, Tuple
from loguru import logger

from classifier import classifier
from cache import cache
from utils.logger import log_prompt_data, get_logger
from config import MODEL_REGISTRY

# Import adapters
from models.openai_adapter import OpenAIAdapter
from models.anthropic_adapter import AnthropicAdapter
from models.local_lmstudio_adapter import LocalLMStudioAdapter

logger = get_logger()

class ModelRouter:
    """
    Core router for NeuroRoute that manages model selection and prompt routing.
    """
    
    def __init__(self):
        """Initialize the router and model adapters."""
        logger.info("Initializing NeuroRoute model router")
        
        # Initialize model adapters
        self.adapters = {}
        self._initialize_adapters()
        
    def _initialize_adapters(self):
        """Initialize all model adapters from the registry."""
        for model_key, model_config in MODEL_REGISTRY.items():
            try:
                if model_key == "openai":
                    self.adapters[model_key] = OpenAIAdapter(model_config)
                elif model_key == "anthropic":
                    self.adapters[model_key] = AnthropicAdapter(model_config)
                elif model_key == "local":
                    self.adapters[model_key] = LocalLMStudioAdapter(model_config)
                else:
                    logger.warning(f"Unknown model type: {model_key}")
                    continue
                    
                logger.info(f"Initialized adapter for {model_key}")
            except Exception as e:
                logger.error(f"Failed to initialize adapter for {model_key}: {e}")
    
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
            
        start_time = time.time()
        
        # Step 1: Check cache
        cached_response = cache.get(prompt, metadata)
        if cached_response:
            logger.info("Using cached response")
            cached_response["from_cache"] = True
            
            # Update response with current latency
            cached_response["cache_latency_ms"] = int((time.time() - start_time) * 1000)
            
            # Log the cached response
            log_data = {
                "timestamp": time.time(),
                "prompt": prompt,
                "metadata": metadata,
                "from_cache": True,
                "model_used": cached_response["model_used"],
                "latency_ms": cached_response["cache_latency_ms"],
                "token_usage": cached_response.get("token_usage", {}),
            }
            log_prompt_data(log_data)
            
            return cached_response
            
        # Step 2: Classify prompt to determine model
        model_key, classification_data = classifier.classify_prompt(prompt, metadata)
        
        # Step 3: Check if the selected model adapter is available
        if model_key not in self.adapters:
            logger.warning(f"Selected model {model_key} not available, falling back to default")
            # Find first available adapter as fallback
            for key in ["openai", "anthropic", "local"]:
                if key in self.adapters:
                    model_key = key
                    break
        
        # Step 4: Generate response using selected model
        logger.info(f"Routing prompt to {model_key} model")
        try:
            response = await self.adapters[model_key].generate_response(prompt, metadata)
            
            # Add classification data and model key for reference
            response["classification"] = classification_data
            response["model_used"] = model_key
            
            # Step 5: Cache the response
            cache.set(prompt, response, metadata)
            
            # Step 6: Log request and response data
            log_data = {
                "timestamp": time.time(),
                "prompt": prompt,
                "metadata": metadata,
                "from_cache": False,
                "model_used": model_key,
                "latency_ms": response["latency_ms"],
                "token_usage": response.get("token_usage", {}),
                "classification_data": classification_data
            }
            log_prompt_data(log_data)
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating response with {model_key}: {e}")
            
            # Attempt fallback if primary model fails
            if model_key != "openai" and "openai" in self.adapters:
                logger.info("Falling back to OpenAI model")
                response = await self.adapters["openai"].generate_response(prompt, metadata)
                response["model_used"] = "openai"
                response["fallback"] = True
                return response
                
            # Return error response if all else fails
            error_response = {
                "model_used": model_key,
                "response": f"Error: {str(e)}",
                "error": True,
                "latency_ms": int((time.time() - start_time) * 1000)
            }
            return error_response

# Singleton instance
router = ModelRouter()