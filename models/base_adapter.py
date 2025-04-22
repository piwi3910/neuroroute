from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Callable, TypeVar, Awaitable, Union, AsyncGenerator
import time
import asyncio
import json
from functools import wraps
from utils.logger import get_logger

logger = get_logger()

# Type variable for decorator type checking
T = TypeVar('T', bound=Callable[..., Awaitable[Dict[str, Any]]])
StreamT = TypeVar('StreamT', bound=Callable[..., AsyncGenerator[Dict[str, Any], None]])

class ModelAdapter(ABC):
    """
    Base adapter interface for LLM models.
    Provides common functionality and required interfaces for all model adapters.
    """
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the model adapter.
        
        Args:
            model_config: Configuration for the model
        """
        self.model_config = model_config
        self.model_name = model_config.get("name", "unknown")
        self.provider = model_config.get("provider", "unknown")
        self.model_id = model_config.get("model_id", "unknown")
        self.max_tokens = model_config.get("max_tokens", 4096)
        self.capabilities = model_config.get("capabilities", [])
        self.max_prompt_length = model_config.get("max_prompt_length", 4000)
        self.supports_streaming = model_config.get("supports_streaming", False)
        self.priority = model_config.get("priority", {"speed": 2, "cost": 2, "quality": 2})
        self._health_status = {"healthy": True, "last_checked": time.time(), "error": None}
        
        # Initialize client in derived classes
        self.client = None
        
    @abstractmethod
    async def generate_response(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response from the model for the given prompt.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Returns:
            Dict containing response, token counts, latency, and other metrics
        """
        pass
    
    async def generate_stream(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate a streaming response from the model.
        Default implementation raises NotImplementedError - override in derived classes.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Yields:
            Dict containing partial response chunks and metadata
        """
        if not self.supports_streaming:
            raise NotImplementedError(f"Streaming not supported for {self.provider} model: {self.model_id}")
        
        # Default implementation - generate full response and yield it as a single chunk
        result = await self.generate_response(prompt, metadata)
        yield {
            "model_used": self.provider,
            "chunk": result["response"],
            "done": True,
            "metadata": {
                "model_id": self.model_id,
                "provider": self.provider
            }
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check if the model is working properly.
        
        Returns:
            Dict with health status information
        """
        try:
            # Simple prompt to test if model is responsive
            test_prompt = "Respond with 'OK' if you can read this message."
            response = await self.generate_response(test_prompt, {"system_prompt": "You are a test assistant."})
            
            if "error" in response and response["error"]:
                self._health_status = {
                    "healthy": False,
                    "last_checked": time.time(),
                    "error": response.get("error_details", "Unknown error"),
                    "latency_ms": response.get("latency_ms", 0)
                }
            else:
                self._health_status = {
                    "healthy": True,
                    "last_checked": time.time(),
                    "latency_ms": response.get("latency_ms", 0)
                }
                
            return self._health_status
        except Exception as e:
            logger.error(f"Health check failed for {self.provider} model {self.model_id}: {e}")
            self._health_status = {
                "healthy": False,
                "last_checked": time.time(),
                "error": str(e)
            }
            return self._health_status
    
    @property
    def health_status(self) -> Dict[str, Any]:
        """Get the current health status without running a new check."""
        return self._health_status
    
    def _process_metadata(self, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process and validate request metadata, applying defaults as needed.
        
        Args:
            metadata: Optional metadata for the request
            
        Returns:
            Processed metadata with defaults applied
        """
        if metadata is None:
            metadata = {}
            
        # Apply default parameters if not provided
        defaults = {
            "max_tokens": min(self.max_tokens, 1000),  # Default to 1000 or model max
            "temperature": 0.7,
            "stream": False,
            "timeout": self.model_config.get("config", {}).get("timeout", 60)
        }
        
        for key, value in defaults.items():
            if key not in metadata:
                metadata[key] = value
                
        # Ensure max_tokens is within model limits
        if metadata.get("max_tokens", 0) > self.max_tokens:
            logger.warning(f"Requested max_tokens {metadata['max_tokens']} exceeds model limit {self.max_tokens}, capping at model limit")
            metadata["max_tokens"] = self.max_tokens
            
        # Add model information to metadata
        metadata["model_id"] = self.model_id
        metadata["provider"] = self.provider
            
        return metadata
    
    def _truncate_prompt_if_needed(self, prompt: str) -> str:
        """
        Truncate the prompt if it exceeds the maximum length supported by the model.
        
        Args:
            prompt: The user prompt
            
        Returns:
            Truncated prompt if needed
        """
        if len(prompt) > self.max_prompt_length:
            logger.warning(f"Prompt exceeds max length for {self.provider}, truncating from {len(prompt)} to {self.max_prompt_length} characters")
            return prompt[:self.max_prompt_length] + "\n\n[Content truncated due to length limits]"
        return prompt
    
    @staticmethod
    def measure_latency(func: T) -> T:
        """
        Decorator to measure and record function execution time.
        
        Args:
            func: The async function to be decorated
            
        Returns:
            Decorated function with latency measurement
        """
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            start_time = time.time()
            try:
                result = await func(self, *args, **kwargs)
                # Add latency to result
                result["latency_ms"] = int((time.time() - start_time) * 1000)
                return result
            except Exception as e:
                logger.error(f"Error in {self.provider} adapter: {e}")
                # Return error response with latency
                return {
                    "response": f"Error: {str(e)}",
                    "error": True,
                    "error_details": str(e),
                    "latency_ms": int((time.time() - start_time) * 1000),
                    "model_used": self.provider,
                    "model_id": self.model_id
                }
        return wrapper
    
    @staticmethod
    def measure_stream_latency(func: StreamT) -> StreamT:
        """
        Decorator to measure and record streaming function execution time.
        
        Args:
            func: The async generator function to be decorated
            
        Returns:
            Decorated streaming function with latency measurement
        """
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            start_time = time.time()
            stream_start = time.time()
            response_chunks = []
            chunk_count = 0
            
            try:
                async for chunk in func(self, *args, **kwargs):
                    chunk_count += 1
                    current_time = time.time()
                    
                    # Add latency information to the chunk
                    chunk["latency_ms"] = int((current_time - start_time) * 1000)
                    chunk["time_to_first_chunk_ms"] = int((current_time - stream_start) * 1000) if chunk_count == 1 else None
                    
                    # Store response chunks for error handling
                    if "chunk" in chunk:
                        response_chunks.append(chunk["chunk"])
                        
                    yield chunk
                    
            except Exception as e:
                logger.error(f"Error in {self.provider} streaming adapter: {e}")
                # Return error response with latency
                error_chunk = {
                    "chunk": f"Error: {str(e)}",
                    "error": True,
                    "error_details": str(e),
                    "latency_ms": int((time.time() - start_time) * 1000),
                    "model_used": self.provider,
                    "model_id": self.model_id,
                    "done": True
                }
                yield error_chunk
                
                # If we had partial results before the error, yield a summary
                if response_chunks:
                    combined_response = "".join(response_chunks)
                    error_chunk = {
                        "chunk": f"\n\nNote: Stream was interrupted. Partial response: {combined_response[:100]}...",
                        "error": True,
                        "partial_response": True,
                        "latency_ms": int((time.time() - start_time) * 1000),
                        "model_used": self.provider,
                        "model_id": self.model_id,
                        "done": True
                    }
                    yield error_chunk
                    
        return wrapper
    
    def _format_response(self, raw_response: Any, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Format the raw model response into a standardized structure.
        
        Args:
            raw_response: The raw response from the model
            metadata: Optional metadata with token counts and other information
            
        Returns:
            Standardized response dict
        """
        response_data = {
            "model_used": self.provider,
            "model_id": self.model_id,
            "response": raw_response,
            # Latency is added by the measure_latency decorator
        }
        
        # Add metadata if provided
        if metadata:
            # Add token counts if available
            if "input_tokens" in metadata:
                response_data["input_tokens"] = metadata["input_tokens"]
            if "output_tokens" in metadata:
                response_data["output_tokens"] = metadata["output_tokens"]
            if "total_tokens" in metadata:
                response_data["total_tokens"] = metadata["total_tokens"]
                
            # Add cost if available
            if "cost" in metadata:
                response_data["cost"] = metadata["cost"]
                
            # Add any model-specific metadata
            for key, value in metadata.items():
                if key not in response_data and key not in ["input_tokens", "output_tokens", "total_tokens", "cost"]:
                    response_data[f"model_{key}"] = value
                    
        return response_data
    
    def _validate_api_key(self):
        """
        Validate that API key is present if required.
        
        Raises:
            ValueError: If API key is missing for a provider that requires it
        """
        if not self.model_config.get("config", {}).get("api_key") and self.provider not in ["lmstudio", "local"]:
            logger.error(f"No API key provided for {self.provider}")
            raise ValueError(f"No API key provided for {self.provider}")
            
    def _estimate_tokens(self, text: str) -> int:
        """
        Estimate the number of tokens in a text string.
        This is a simple approximation - actual token count depends on the tokenizer.
        
        Args:
            text: Input text
            
        Returns:
            Estimated token count
        """
        # Simple approximation: 1 token ≈ 4 characters for English text
        return max(1, len(text) // 4)
    
    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Estimate the cost of a request based on token counts.
        
        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Estimated cost in USD
        """
        cost_per_1k = self.model_config.get("cost_per_1k_tokens", 0.0)
        
        if cost_per_1k <= 0:
            return 0.0
            
        # Some providers charge differently for input vs output tokens
        input_cost = cost_per_1k * input_tokens / 1000
        output_cost = cost_per_1k * output_tokens / 1000
        
        return input_cost + output_cost
    
    async def close(self):
        """
        Close any resources used by the adapter.
        Override in derived classes if needed.
        """
        pass

    async def __aenter__(self):
        """Support for async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Support for async context manager."""
        await self.close()