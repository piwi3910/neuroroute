from typing import Dict, Any, Optional
from openai import AsyncOpenAI
import os
from loguru import logger

from .base_adapter import ModelAdapter


class OpenAIAdapter(ModelAdapter):
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the OpenAI client and configuration.
        
        Args:
            model_config: Configuration for the OpenAI model
        """
        super().__init__(model_config)
        
        # Extract configuration
        config = model_config.get("config", {})
        self.api_key = config.get("api_key")
        self.model = config.get("model", "gpt-4o")
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 4096)
        self.timeout = config.get("timeout", 30)  # timeout in seconds
        
        # Try to get API key from database
        self._get_api_key_from_db()
        
        # Validate API key
        self._validate_api_key()
        
        # Initialize async client
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            timeout=self.timeout
        )
        
        logger.info(f"Initialized OpenAI adapter with model: {self.model}")
        
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
                ("openai",)
            )
            result = cursor.fetchone()
            if result:
                self.api_key = result["api_key"]
                logger.info("Using OpenAI API key from database")
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to get OpenAI API key from database: {e}")

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
            
            # Make request to OpenAI API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                # Optional stream parameter could be added here based on metadata
            )
            
            # Extract response text
            response_text = response.choices[0].message.content
            
            # Extract token usage information
            token_usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
            
            return {
                "response": response_text,
                "model_used": "openai",
                "token_usage": token_usage,
                "finish_reason": response.choices[0].finish_reason,
                "model": self.model
            }
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise
            
    def _validate_api_key(self):
        """
        Validate that an API key is available.
        """
        if not self.api_key:
            # Try to get from environment
            self.api_key = os.environ.get("OPENAI_API_KEY")
            
        if not self.api_key:
            raise Exception("Authentication error: Check your API key")
            
    async def get_token_count(self, text: str) -> int:
        """
        Get the number of tokens in the text.
        
        Args:
            text: The text to count tokens for
            
        Returns:
            The number of tokens
        """
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
        # GPT-4o pricing (as of April 2024)
        pricing = {
            "input": 5.0,    # $5.00 per million tokens
            "output": 15.0   # $15.00 per million tokens
        }
        
        prompt_cost = (token_usage.get("prompt_tokens", 0) / 1000) * pricing["input"]
        completion_cost = (token_usage.get("completion_tokens", 0) / 1000) * pricing["output"]
        
        return round(prompt_cost + completion_cost, 6)  # Round to 6 decimal places