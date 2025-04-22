from typing import Dict, Any, Optional, List
import asyncio
import anthropic
from anthropic import AsyncAnthropic
from loguru import logger
from models.base_adapter import ModelAdapter

class AnthropicAdapter(ModelAdapter):
    """Adapter for Anthropic Claude models."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the Anthropic client and configuration.
        
        Args:
            model_config: Configuration for the Anthropic model
        """
        super().__init__(model_config)
        self._validate_api_key()
        
        # Extract configuration
        config = model_config.get("config", {})
        self.api_key = config.get("api_key")
        self.model = config.get("model", "claude-3-sonnet-20240229")
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 4096)
        self.timeout = config.get("timeout", 30)  # timeout in seconds
        
        # Initialize async client
        self.client = AsyncAnthropic(
            api_key=self.api_key, 
            timeout=self.timeout
        )
        
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
        # Set up default empty metadata
        if metadata is None:
            metadata = {}
        
        try:
            # Configure request parameters
            max_tokens = metadata.get("max_tokens", self.max_tokens)
            temperature = metadata.get("temperature", self.temperature)
            
            # Build system prompt - can be customized later based on metadata
            system_prompt = "You are a helpful AI assistant."
            
            # Make request to Anthropic API using the messages API
            # This is the recommended approach for all new Claude models
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract response text from message content
            # Handle both text-only and mixed content types
            response_text = ""
            for content_block in message.content:
                if content_block.type == "text":
                    response_text += content_block.text
            
            # Extract token usage information
            token_usage = {
                "prompt_tokens": message.usage.input_tokens,
                "completion_tokens": message.usage.output_tokens,
                "total_tokens": message.usage.input_tokens + message.usage.output_tokens
            }
            
            return {
                "response": response_text,
                "model_used": "anthropic",
                "token_usage": token_usage,
                "stop_reason": message.stop_reason,
                "model_name": self.model,
                "cost_estimate_usd": self._calculate_cost_estimate(token_usage)
            }
            
        except anthropic.RateLimitError as e:
            logger.warning(f"Anthropic rate limit exceeded: {e}")
            raise Exception(f"Rate limit exceeded: {str(e)}")
        except anthropic.APITimeoutError as e:
            logger.warning(f"Anthropic API timeout: {e}")
            raise Exception(f"API timeout: {str(e)}")
        except anthropic.APIConnectionError as e:
            logger.error(f"Anthropic API connection error: {e}")
            raise Exception(f"Connection error: {str(e)}")
        except anthropic.BadRequestError as e:
            logger.error(f"Anthropic API bad request: {e}")
            raise Exception(f"Bad request: {str(e)}")
        except anthropic.APIStatusError as e:
            logger.error(f"Anthropic API status error: {e}")
            raise Exception(f"API status error: {str(e)}")
        except anthropic.AuthenticationError as e:
            logger.error(f"Anthropic API authentication error: {e}")
            raise Exception(f"Authentication error: Check your API key")
        except Exception as e:
            logger.error(f"Anthropic API unexpected error: {e}")
            raise Exception(f"Unexpected error: {str(e)}")
    
    def _calculate_cost_estimate(self, token_usage: Dict[str, int]) -> float:
        """
        Calculate estimated cost of the API call.
        
        Args:
            token_usage: Token usage metrics from the API response
            
        Returns:
            Estimated cost in USD
        """
        # Pricing per 1M tokens (simplified estimates)
        # These rates should be updated regularly as pricing changes
        model_pricing = {
            "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
            "claude-3-sonnet-20240229": {"input": 3.0, "output": 15.0},
            "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
            "claude-2.1": {"input": 8.0, "output": 24.0},
            "claude-2.0": {"input": 8.0, "output": 24.0},
            "claude-instant-1.2": {"input": 0.8, "output": 2.4}
        }
        
        # Get pricing for the current model, default to sonnet if not found
        pricing = model_pricing.get(
            self.model, 
            model_pricing.get("claude-3-sonnet-20240229")
        )
        
        # Calculate cost (converting from per 1M tokens to per token)
        prompt_cost = (token_usage.get("prompt_tokens", 0) * pricing["input"]) / 1_000_000
        completion_cost = (token_usage.get("completion_tokens", 0) * pricing["output"]) / 1_000_000
        
        return round(prompt_cost + completion_cost, 6)  # Round to 6 decimal places