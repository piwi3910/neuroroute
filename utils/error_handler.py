"""
Error Handler Utility for NeuroRoute

This module provides standardized error handling for different types of errors
that may occur when interacting with LLM providers.
"""

import time
import logging
from typing import Dict, Any, Optional, Union, List, Tuple
from fastapi import HTTPException, status

# Error types
class ModelError(Exception):
    """Base class for model-related errors"""
    def __init__(self, message: str, model: str = None, status_code: int = 500):
        self.message = message
        self.model = model
        self.status_code = status_code
        self.timestamp = time.time()
        super().__init__(self.message)

class ModelNotAvailableError(ModelError):
    """Error raised when a model is not available"""
    def __init__(self, model: str, message: str = None):
        super().__init__(
            message or f"Model '{model}' is not available",
            model=model,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

class ModelTimeoutError(ModelError):
    """Error raised when a model request times out"""
    def __init__(self, model: str, timeout: float, message: str = None):
        super().__init__(
            message or f"Request to model '{model}' timed out after {timeout} seconds",
            model=model,
            status_code=status.HTTP_504_GATEWAY_TIMEOUT
        )

class ModelRateLimitError(ModelError):
    """Error raised when a model's rate limit is exceeded"""
    def __init__(self, model: str, message: str = None):
        super().__init__(
            message or f"Rate limit exceeded for model '{model}'",
            model=model,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )

class ModelAuthenticationError(ModelError):
    """Error raised when authentication with a model provider fails"""
    def __init__(self, model: str, message: str = None):
        super().__init__(
            message or f"Authentication failed for model '{model}'",
            model=model,
            status_code=status.HTTP_401_UNAUTHORIZED
        )

class ModelTokenLimitError(ModelError):
    """Error raised when a prompt exceeds the model's token limit"""
    def __init__(self, model: str, token_limit: int, token_count: int, message: str = None):
        super().__init__(
            message or f"Prompt exceeds token limit for model '{model}' ({token_count}/{token_limit})",
            model=model,
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        )

class ModelContentFilterError(ModelError):
    """Error raised when content is filtered by the model provider"""
    def __init__(self, model: str, message: str = None):
        super().__init__(
            message or f"Content was filtered by model '{model}'",
            model=model,
            status_code=status.HTTP_400_BAD_REQUEST
        )

class NetworkError(ModelError):
    """Error raised when there are network connectivity issues"""
    def __init__(self, model: str = None, message: str = None):
        super().__init__(
            message or f"Network connectivity issue when connecting to model provider",
            model=model,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

class InvalidPromptError(ModelError):
    """Error raised when a prompt is invalid"""
    def __init__(self, message: str = "Invalid prompt format"):
        super().__init__(
            message,
            status_code=status.HTTP_400_BAD_REQUEST
        )

class AllModelsFailedError(ModelError):
    """Error raised when all models fail to process a prompt"""
    def __init__(self, errors: Dict[str, str] = None):
        self.errors = errors or {}
        models = ", ".join(self.errors.keys())
        super().__init__(
            f"All models failed to process the prompt: {models}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# Error handling functions
def handle_openai_error(error: Exception, model: str = "openai") -> Tuple[str, int]:
    """
    Handle OpenAI-specific errors and convert them to standardized errors.
    
    Args:
        error: The OpenAI error
        model: The model name
        
    Returns:
        Tuple of (error message, status code)
    """
    error_str = str(error).lower()
    
    if "rate limit" in error_str:
        return ModelRateLimitError(model)
    elif "timeout" in error_str:
        return ModelTimeoutError(model, 60.0)
    elif "authentication" in error_str or "api key" in error_str:
        return ModelAuthenticationError(model)
    elif "maximum context length" in error_str or "token limit" in error_str:
        return ModelTokenLimitError(model, 8192, 0)
    elif "content filter" in error_str or "content policy" in error_str:
        return ModelContentFilterError(model)
    elif "connection" in error_str or "network" in error_str:
        return NetworkError(model)
    else:
        return ModelError(f"OpenAI error: {str(error)}", model)

def handle_anthropic_error(error: Exception, model: str = "anthropic") -> Tuple[str, int]:
    """
    Handle Anthropic-specific errors and convert them to standardized errors.
    
    Args:
        error: The Anthropic error
        model: The model name
        
    Returns:
        Tuple of (error message, status code)
    """
    error_str = str(error).lower()
    
    if "rate limit" in error_str:
        return ModelRateLimitError(model)
    elif "timeout" in error_str:
        return ModelTimeoutError(model, 120.0)
    elif "authentication" in error_str or "api key" in error_str:
        return ModelAuthenticationError(model)
    elif "maximum context length" in error_str or "token limit" in error_str:
        return ModelTokenLimitError(model, 100000, 0)
    elif "content filter" in error_str or "content policy" in error_str:
        return ModelContentFilterError(model)
    elif "connection" in error_str or "network" in error_str:
        return NetworkError(model)
    else:
        return ModelError(f"Anthropic error: {str(error)}", model)

def handle_lmstudio_error(error: Exception, model: str = "local") -> Tuple[str, int]:
    """
    Handle LM Studio-specific errors and convert them to standardized errors.
    
    Args:
        error: The LM Studio error
        model: The model name
        
    Returns:
        Tuple of (error message, status code)
    """
    error_str = str(error).lower()
    
    if "timeout" in error_str:
        return ModelTimeoutError(model, 30.0)
    elif "connection" in error_str or "network" in error_str or "refused" in error_str:
        return NetworkError(model, "Could not connect to local LM Studio instance")
    else:
        return ModelError(f"LM Studio error: {str(error)}", model)

def format_error_response(error: Exception, request_id: str = None) -> Dict[str, Any]:
    """
    Format an error into a standardized response format.
    
    Args:
        error: The error to format
        request_id: Optional request ID
        
    Returns:
        Formatted error response
    """
    if isinstance(error, ModelError):
        status_code = error.status_code
        message = error.message
        model = error.model
    else:
        status_code = 500
        message = str(error)
        model = None
    
    response = {
        "error": True,
        "detail": message,
        "timestamp": time.time(),
        "status_code": status_code
    }
    
    if request_id:
        response["request_id"] = request_id
        
    if model:
        response["model"] = model
        
    if isinstance(error, AllModelsFailedError):
        response["model_errors"] = error.errors
        
    return response