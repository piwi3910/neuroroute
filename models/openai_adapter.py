from typing import Dict, Any, Optional, List
import openai
from openai import AsyncOpenAI
import asyncio
import os
from loguru import logger
from models.base_adapter import ModelAdapter

class OpenAIAdapter(ModelAdapter):
    """Adapter for OpenAI models."""
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the OpenAI client and configuration.
        
        Args:
            model_config: Configuration for the OpenAI model
        """
        super().__init__(model_config)
        self._validate_api_key()
        
        # Extract configuration
        config = model_config.get("config", {})
        self.api_key = config.get("api_key")
        self.model = config.get("model", "gpt-4o")
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 4096)
        self.timeout = config.get("timeout", 30)  # timeout in seconds
        
        # Initialize async client
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            timeout=self.timeout
        )
        
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
        # Set up default empty metadata
        if metadata is None:
            metadata = {}
        
        try:
            # Configure request parameters
            max_tokens = metadata.get("max_tokens", self.max_tokens)
            temperature = metadata.get("temperature", self.temperature)
            
            # Build system prompt - can be customized later based on metadata
            system_prompt = "You are a helpful assistant."
            
            # Make request to OpenAI API
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                # Optional stream parameter could be added here based on metadata
            )
            
            # Extract response text
            response_text = completion.choices[0].message.content.strip()
            
            # Prepare detailed response with metrics
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
                "model_name": self.model,
                "cost_estimate_usd": self._calculate_cost_estimate(token_usage)
            }
            
        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit exceeded: {e}")
            raise Exception(f"Rate limit exceeded: {str(e)}")
        except openai.APITimeoutError as e:
            logger.warning(f"OpenAI API timeout: {e}")
            raise Exception(f"API timeout: {str(e)}")
        except openai.APIConnectionError as e:
            logger.error(f"OpenAI API connection error: {e}")
            raise Exception(f"Connection error: {str(e)}")
        except openai.BadRequestError as e:
            logger.error(f"OpenAI API bad request: {e}")
            raise Exception(f"Bad request: {str(e)}")
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI API authentication error: {e}")
            raise Exception(f"Authentication error: Check your API key")
        except Exception as e:
            logger.error(f"OpenAI API unexpected error: {e}")
            raise Exception(f"Unexpected error: {str(e)}")
    
    def _calculate_cost_estimate(self, token_usage: Dict[str, int]) -> float:
        """
        Calculate estimated cost of the API call.
        
        Args:
            token_usage: Token usage metrics from the API response
            
        Returns:
            Estimated cost in USD
        """
        # Pricing per 1000 tokens (simplified estimates)
        # These rates should be updated regularly as pricing changes
        model_pricing = {
            "gpt-4o": {"input": 0.005, "output": 0.015},
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015}
        }
        
        # Get pricing for the current model, default to gpt-4o if not found
        pricing = model_pricing.get(self.model, model_pricing["gpt-4o"])
        
        # Calculate cost
        prompt_cost = (token_usage.get("prompt_tokens", 0) / 1000) * pricing["input"]
        completion_cost = (token_usage.get("completion_tokens", 0) / 1000) * pricing["output"]
        
        return round(prompt_cost + completion_cost, 6)  # Round to 6 decimal places