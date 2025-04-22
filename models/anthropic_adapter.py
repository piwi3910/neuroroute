from typing import Dict, Any, Optional
import asyncio
from anthropic import AsyncAnthropic
import os
from loguru import logger

from .base_adapter import ModelAdapter


class AnthropicAdapter(ModelAdapter):
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the Anthropic client and configuration.
        
        Args:
            model_config: Configuration for the Anthropic model
        """
        super().__init__(model_config)
        
        # Extract configuration
        config = model_config.get("config", {})
        self.api_key = config.get("api_key")
        self.model = config.get("model", "claude-3-sonnet-20240229")
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 4096)
        self.timeout = config.get("timeout", 30)  # timeout in seconds
        
        # Try to get API key from database
        self._get_api_key_from_db()
        
        # Validate API key
        self._validate_api_key()
        
        # Initialize async client
        self.client = AsyncAnthropic(
            api_key=self.api_key,
            timeout=self.timeout
        )
        
        logger.info(f"Initialized Anthropic adapter with model: {self.model}")
        
    def _get_api_key_from_db(self):
        """
        Try to get API key from database.
        If found, use it instead of the one from environment variables.
        """
        try:
            import sqlite3
            conn = sqlite3.connect("./db_data/api_keys.db")
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT api_key FROM api_keys WHERE provider = ? AND is_active = 1", 
                ("anthropic",)
            )
            result = cursor.fetchone()
            if result:
                self.api_key = result["api_key"]
                logger.info("Using Anthropic API key from database")
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to get Anthropic API key from database: {e}")

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
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract response text from message content
            response_text = ""
            for content_block in response.content:
                if content_block.type == "text":
                    response_text += content_block.text
            
            # Extract token usage information
            token_usage = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
            
            return {
                "response": response_text,
                "model_used": "anthropic",
                "token_usage": token_usage,
                "stop_reason": response.stop_reason,
                "finish_reason": response.stop_reason,  # For compatibility with OpenAI
                "model": self.model
            }
            
        except Exception as e:
            logger.error(f"Anthropic API unexpected error: {e}")
            raise
            
    def _validate_api_key(self):
        """
        Validate that an API key is available.
        """
        if not self.api_key:
            # Try to get from environment
            self.api_key = os.environ.get("ANTHROPIC_API_KEY")
            
        if not self.api_key:
            raise Exception(f"Authentication error: Check your API key")
            
    async def get_token_count(self, text: str) -> int:
        """
        Get the number of tokens in the text.
        
        Args:
            text: The text to count tokens for
            
        Returns:
            The number of tokens
        """
        # Anthropic doesn't provide a direct token counting method
        # This is a rough estimate based on GPT tokenization
        return len(text.split()) * 1.3
        
    def calculate_cost(self, token_usage: Dict[str, int]) -> float:
        """
        Calculate the cost of the API call based on token usage.
        
        Args:
            token_usage: Dict with prompt_tokens and completion_tokens
            
        Returns:
            The cost in USD
        """
        # Claude 3 Sonnet pricing (as of April 2024)
        pricing = {
            "input": 3.0,    # $3.00 per million tokens
            "output": 15.0   # $15.00 per million tokens
        }
        
        prompt_cost = (token_usage.get("prompt_tokens", 0) * pricing["input"]) / 1_000_000
        completion_cost = (token_usage.get("completion_tokens", 0) * pricing["output"]) / 1_000_000
        
        return round(prompt_cost + completion_cost, 6)  # Round to 6 decimal places