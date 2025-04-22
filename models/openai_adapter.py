from typing import Dict, Any, Optional
import openai
from loguru import logger
from models.base_adapter import ModelAdapter

class OpenAIAdapter(ModelAdapter):
    """Adapter for OpenAI models."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """Initialize the OpenAI client and configuration."""
        super().__init__(model_config)
        self._validate_api_key()
        
        self.client = openai.OpenAI(api_key=model_config["config"]["api_key"])
        self.model = model_config["config"].get("model", "gpt-4o")
        self.temperature = model_config["config"].get("temperature", 0.7)
        self.max_tokens = model_config["config"].get("max_tokens", 4096)
        
        logger.info(f"Initialized OpenAI adapter with model: {self.model}")
    
    @ModelAdapter.measure_latency
    async def generate_response(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response from OpenAI for the given prompt.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request
            
        Returns:
            Dict containing response, token usage, latency, etc.
        """
        try:
            # Configure request parameters
            max_tokens = metadata.get("max_tokens", self.max_tokens) if metadata else self.max_tokens
            temperature = metadata.get("temperature", self.temperature) if metadata else self.temperature
            
            # Make request to OpenAI API
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Extract response text
            response_text = completion.choices[0].message.content.strip()
            
            # Prepare response with metrics
            token_usage = {
                "prompt_tokens": completion.usage.prompt_tokens,
                "completion_tokens": completion.usage.completion_tokens,
                "total_tokens": completion.usage.total_tokens
            }
            
            return {
                "response": response_text,
                "model_used": "openai",
                "token_usage": token_usage,
                "finish_reason": completion.choices[0].finish_reason,
                "model_name": self.model
            }
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise