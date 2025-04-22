from typing import Dict, Any, Optional, List
import httpx
import json
import time
from loguru import logger
from models.base_adapter import ModelAdapter

class LocalLMStudioAdapter(ModelAdapter):
    """Adapter for local LLM models running via LM Studio."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the local LM Studio configuration.
        
        Args:
            model_config: Configuration for the local LM Studio instance
        """
        super().__init__(model_config)
        
        # Extract configuration
        config = model_config.get("config", {})
        self.base_url = config.get("url", "http://localhost:1234/v1")
        self.timeout = config.get("timeout", 60)  # Default 60 second timeout
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 4096)
        self.model_name = config.get("model_name", "local-lmstudio")
        
        logger.info(f"Initialized Local LM Studio adapter at {self.base_url}")
    
    @ModelAdapter.measure_latency
    async def generate_response(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response from a local LLM for the given prompt.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Returns:
            Dict containing response, latency, etc.
        """
        # Set up default empty metadata
        if metadata is None:
            metadata = {}
        
        try:
            # Configure request parameters
            temperature = metadata.get("temperature", self.temperature)
            max_tokens = metadata.get("max_tokens", self.max_tokens)
            
            # Build system message - can be customized later based on metadata
            system_message = "You are a helpful assistant."
            
            # Prepare the request payload for LM Studio API (compatible with OpenAI format)
            payload = {
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False  # Could make this configurable in the future
            }
            
            # Log request details at debug level
            logger.debug(f"Sending request to LM Studio: {json.dumps(payload)[:200]}...")
            
            start_time = time.time()
            
            # Make request to LM Studio API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                # Calculate request latency
                request_latency_ms = int((time.time() - start_time) * 1000)
                logger.debug(f"LM Studio request completed in {request_latency_ms}ms")
                
                # Handle HTTP errors
                response.raise_for_status()
                result = response.json()
            
            # Extract response text
            response_text = result["choices"][0]["message"]["content"].strip()
            
            # Local LLMs may not provide token counts
            token_usage = {}
            if "usage" in result:
                token_usage = {
                    "prompt_tokens": result["usage"].get("prompt_tokens", 0),
                    "completion_tokens": result["usage"].get("completion_tokens", 0),
                    "total_tokens": result["usage"].get("total_tokens", 0)
                }
            else:
                # Estimate token count based on text length (very approximate)
                # Adjust these values based on your tokenizer
                estimated_prompt_tokens = len(prompt) // 4
                estimated_completion_tokens = len(response_text) // 4
                token_usage = {
                    "prompt_tokens": estimated_prompt_tokens,
                    "completion_tokens": estimated_completion_tokens,
                    "total_tokens": estimated_prompt_tokens + estimated_completion_tokens,
                    "estimated": True  # Flag that these are estimates
                }
            
            # Build response object
            response_obj = {
                "response": response_text,
                "model_used": "local",
                "token_usage": token_usage,
                "finish_reason": result["choices"][0].get("finish_reason", "unknown"),
                "model_name": result.get("model", self.model_name),
                "cost_estimate_usd": 0.0  # Local models are free
            }
            
            # Add any extra metadata from the LM Studio response
            if "id" in result:
                response_obj["request_id"] = result["id"]
            
            return response_obj
            
        except httpx.HTTPStatusError as e:
            error_message = f"LM Studio HTTP error: {e.response.status_code}"
            try:
                error_json = e.response.json()
                if "error" in error_json:
                    error_message += f" - {error_json['error']['message']}"
            except:
                error_message += f" - {e.response.text}"
            
            logger.error(error_message)
            raise Exception(error_message)
            
        except httpx.RequestError as e:
            error_message = f"Failed to connect to LM Studio at {self.base_url}. Ensure it's running."
            logger.error(f"LM Studio connection error: {e}")
            raise Exception(error_message)
            
        except httpx.TimeoutException as e:
            error_message = f"Request to LM Studio timed out after {self.timeout}s"
            logger.error(f"LM Studio timeout: {e}")
            raise Exception(error_message)
            
        except json.JSONDecodeError as e:
            error_message = "Invalid JSON response from LM Studio"
            logger.error(f"{error_message}: {e}")
            raise Exception(error_message)
            
        except Exception as e:
            error_message = f"Unexpected error with LM Studio adapter: {str(e)}"
            logger.error(error_message)
            raise Exception(error_message)
    
    async def check_health(self) -> Dict[str, Any]:
        """
        Check if the LM Studio server is running and healthy.
        
        Returns:
            Dict with health status information
        """
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base_url}/models")
                response.raise_for_status()
                
                return {
                    "status": "healthy",
                    "message": "LM Studio is running",
                    "models": response.json()
                }
        except Exception as e:
            logger.warning(f"LM Studio health check failed: {e}")
            return {
                "status": "unhealthy",
                "message": f"LM Studio connection error: {str(e)}"
            }