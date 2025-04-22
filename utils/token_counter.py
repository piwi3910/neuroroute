"""
Token Counter Utility for NeuroRoute

This module provides functions for counting tokens in prompts and responses
for different LLM providers. It supports different tokenization methods
based on the model being used.
"""

import re
import tiktoken
from typing import Dict, Any, Optional, Union, List

# Default tokenizer for fallback
def _default_token_count(text: str) -> int:
    """
    Simple approximation of token count based on whitespace and punctuation.
    This is a fallback method when model-specific tokenizers are not available.
    
    Args:
        text: The text to count tokens for
        
    Returns:
        Estimated token count
    """
    # Split on whitespace and punctuation
    tokens = re.findall(r'\w+|[^\w\s]', text)
    return len(tokens)

# OpenAI token counting
def count_openai_tokens(text: str, model: str = "gpt-4o") -> int:
    """
    Count tokens for OpenAI models using tiktoken.
    
    Args:
        text: The text to count tokens for
        model: The OpenAI model name
        
    Returns:
        Token count
    """
    try:
        # Map model names to encoding
        if model.startswith("gpt-4"):
            encoding = tiktoken.encoding_for_model("gpt-4")
        elif model.startswith("gpt-3.5"):
            encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
        else:
            encoding = tiktoken.get_encoding("cl100k_base")  # Default for newer models
            
        # Count tokens
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        # Fallback to default method if tiktoken fails
        return _default_token_count(text)

# Anthropic token counting
def count_anthropic_tokens(text: str, model: str = "claude-3-sonnet-20240229") -> int:
    """
    Count tokens for Anthropic Claude models.
    Uses tiktoken with cl100k_base encoding as an approximation.
    
    Args:
        text: The text to count tokens for
        model: The Anthropic model name
        
    Returns:
        Token count
    """
    try:
        # Claude uses a similar tokenizer to cl100k_base
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        # Fallback to default method if tiktoken fails
        return _default_token_count(text)

# LM Studio token counting
def count_lmstudio_tokens(text: str, model: str = "mistral") -> int:
    """
    Count tokens for local LM Studio models.
    Uses a simple approximation based on words and punctuation.
    
    Args:
        text: The text to count tokens for
        model: The LM Studio model name
        
    Returns:
        Token count
    """
    # For local models, we use the default approximation
    return _default_token_count(text)

# Main function to count tokens based on model provider
def count_tokens(text: str, provider: str = "auto", model: str = None) -> int:
    """
    Count tokens for a given text based on the provider and model.
    
    Args:
        text: The text to count tokens for
        provider: The model provider (openai, anthropic, local)
        model: The specific model name
        
    Returns:
        Token count
    """
    if not text:
        return 0
        
    # Select the appropriate counting function based on provider
    if provider == "openai":
        return count_openai_tokens(text, model or "gpt-4o")
    elif provider == "anthropic":
        return count_anthropic_tokens(text, model or "claude-3-sonnet-20240229")
    elif provider == "local" or provider == "lmstudio":
        return count_lmstudio_tokens(text, model or "mistral")
    else:
        # Auto-detect or fallback
        return _default_token_count(text)

# Count tokens for a prompt and response
def count_total_tokens(prompt: str, response: str, provider: str = "auto", model: str = None) -> Dict[str, int]:
    """
    Count tokens for both prompt and response, returning a breakdown.
    
    Args:
        prompt: The prompt text
        response: The response text
        provider: The model provider
        model: The specific model name
        
    Returns:
        Dictionary with prompt_tokens, completion_tokens, and total_tokens
    """
    prompt_tokens = count_tokens(prompt, provider, model)
    completion_tokens = count_tokens(response, provider, model)
    
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens
    }