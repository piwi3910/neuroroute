from typing import Dict, Any, Optional
import anthropic
from loguru import logger
from models.base_adapter import ModelAdapter

class AnthropicAdapter(ModelAdapter):
    """Adapter for Anthropic Claude models."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """Initialize the Anthropic client and configuration."""
        super().__init__(model_config)
        self._validate_api_key()
        
        self.client = anthropic.Anthropic(api_key=model_config["config"]["api_key"])
        self.model = model_config["config"].get("model", "claude-3-sonnet-20240229")
        self.temperature = model_config["config"].get("temperature", 0.7)
        self.max_tokens = model_config["config"].get("max_tokens", 4096)
        
        logger.info(f"Initialized Anthropic adapter with model: {self.model}")
    
    @ModelAdapter.measure_latency
    async def generate_response(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response from Anthropic Claude for the given prompt.
        
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
            
            # Make request to Anthropic API
            message = self.client.messages.create(
                model=self.model,
                system="You are a helpful assistant.",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Extract response text
            response_text = message.content[0].text
            
            # Prepare response with metrics
            token_usage = {
                "input_tokens": message.usage.input_tokens,
                "output_tokens": message.usage.output_tokens,
                "total_tokens": message.usage.input_tokens + message.usage.output_tokens
            }
            
            return {
                "response": response_text,
                "model_used": "anthropic",
                "token_usage": token_usage,
                "stop_reason": message.stop_reason,
                "model_name": self.model
            }
            
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise