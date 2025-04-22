from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import time
from utils.logger import get_logger

logger = get_logger()

class ModelAdapter(ABC):
    """Base adapter interface for LLM models."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the model adapter.
        
        Args:
            model_config: Configuration for the model
        """
        self.model_config = model_config
        self.model_name = model_config.get("name", "unknown")
        self.provider = model_config.get("provider", "unknown")
        self.max_tokens = model_config.get("max_tokens", 4096)
        
    @abstractmethod
    async def generate_response(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response from the model for the given prompt.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Returns:
            Dict containing response, latency, and other metrics
        """
        pass
    
    def measure_latency(func):
        """Decorator to measure and record function execution time."""
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
                    "latency_ms": int((time.time() - start_time) * 1000),
                    "model_used": self.provider
                }
        return wrapper
    
    def _format_response(self, raw_response: Any, latency_ms: int) -> Dict[str, Any]:
        """
        Format the raw model response into a standardized structure.
        
        Args:
            raw_response: The raw response from the model
            latency_ms: The measured latency in milliseconds
            
        Returns:
            Standardized response dict
        """
        return {
            "model_used": self.provider,
            "response": raw_response,
            "latency_ms": latency_ms,
        }
    
    def _validate_api_key(self):
        """Validate that API key is present if required."""
        if not self.model_config.get("config", {}).get("api_key") and self.provider != "lmstudio":
            logger.error(f"No API key provided for {self.provider}")
            raise ValueError(f"No API key provided for {self.provider}")