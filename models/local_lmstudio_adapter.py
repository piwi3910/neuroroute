from typing import Dict, Any, Optional
import httpx
from loguru import logger
from models.base_adapter import ModelAdapter

class LocalLMStudioAdapter(ModelAdapter):
    """Adapter for local LLM models running via LM Studio."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """Initialize the local LM Studio configuration."""
        super().__init__(model_config)
        
        self.base_url = model_config["config"]["url"]
        self.timeout = model_config["config"].get("timeout", 60)  # Default 60 second timeout
        
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
        try:
            # Configure request parameters
            temperature = metadata.get("temperature", 0.7) if metadata else 0.7
            max_tokens = metadata.get("max_tokens", self.max_tokens) if metadata else self.max_tokens
            
            # Prepare the request payload for LM Studio API (compatible with OpenAI format)
            payload = {
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            # Make request to LM Studio API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload
                )
                
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
            
            return {
                "response": response_text,
                "model_used": "local",
                "token_usage": token_usage,
                "finish_reason": result["choices"][0].get("finish_reason", "unknown"),
                "model_name": result.get("model", "local-lmstudio")
            }
            
        except httpx.HTTPStatusError as e:
            logger.error(f"LM Studio HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"LM Studio connection error: {e}")
            raise ValueError(f"Failed to connect to LM Studio at {self.base_url}. Ensure it's running.")
        except Exception as e:
            logger.error(f"LM Studio adapter error: {e}")
            raise