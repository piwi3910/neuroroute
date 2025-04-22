import os
import json
from enum import Enum, auto
from typing import Dict, Any, List, Optional, Union, Set, Literal
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings
from pydantic import validator, root_validator
import logging

# Intent keywords for classification (will be used by the classifier)
INTENT_KEYWORDS = {
    "local": [
        "hello", "hi", "greetings", "create file", "basic math", "simple", "quick", 
        "calculate", "help", "math", "what is", "example"
    ],
    "openai": [
        "analyze", "summarize", "code", "compare", "write code", "debug", "complex",
        "explain", "how to", "review", "generate", "create function", "algorithm"
    ],
    "anthropic": [
        "long document", "legal", "detailed reasoning", "extensive", "thorough",
        "comprehensive", "ethical", "draft", "essay", "research", "in-depth"
    ]
}

class LogSettings(BaseSettings):
    """Settings for logging configuration"""
    log_level: str = Field("INFO", description="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)")
    log_format: str = Field(
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        description="Loguru format string for log formatting"
    )
    log_dir: str = Field("logs", description="Directory for log files")
    log_retention: str = Field("7 days", description="Log retention period")
    log_rotation: str = Field("10 MB", description="Log rotation size")
    console_logging: bool = Field(True, description="Enable console logging")
    json_logging: bool = Field(False, description="Enable JSON-formatted logging")
    log_request_body: bool = Field(False, description="Whether to log full request bodies (may contain sensitive data)")
    log_response_body: bool = Field(False, description="Whether to log full response bodies")
    log_prompt_content: bool = Field(False, description="Whether to log the content of prompts (may contain sensitive data)")
    log_to_file: bool = Field(True, description="Whether to log to files in addition to console")
    structured_logging: bool = Field(False, description="Use structured logging format (enables better filtering)")
    log_metrics: bool = Field(True, description="Log performance metrics")
    
    @validator("log_level")
    def validate_log_level(cls, v):
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of {valid_levels}")
        return v.upper()

class RedisSettings(BaseSettings):
    """Settings for Redis cache configuration"""
    enabled: bool = Field(False, description="Enable Redis caching")
    host: str = Field("localhost", description="Redis host")
    port: int = Field(6379, description="Redis port")
    db: int = Field(0, description="Redis database index")
    password: Optional[str] = Field(None, description="Redis password")
    ttl: int = Field(600, description="Default TTL in seconds (10 minutes)")
    key_prefix: str = Field("neuroroute:", description="Prefix for all Redis keys")
    connect_timeout: float = Field(3.0, description="Connection timeout in seconds")
    timeout: float = Field(3.0, description="Redis command timeout in seconds")
    max_retries: int = Field(3, description="Maximum reconnection attempts")
    reconnect_delay: int = Field(5, description="Seconds to wait between reconnection attempts")
    pool_size: int = Field(10, description="Connection pool size")
    use_hash: bool = Field(True, description="Use Redis hash for storing complex objects")
    compression: bool = Field(True, description="Compress cache values to save space")
    
    # Cache strategy settings
    cache_responses: bool = Field(True, description="Cache LLM responses")
    cache_streaming: bool = Field(False, description="Cache streaming responses (challenging but possible)")
    cache_embeddings: bool = Field(True, description="Cache embedding calculations")
    
    @validator("ttl")
    def validate_ttl(cls, v):
        if v <= 0:
            raise ValueError("TTL must be positive")
        return v

class MonitoringSettings(BaseSettings):
    """Settings for monitoring and telemetry"""
    enable_metrics: bool = Field(True, description="Enable metrics collection")
    prometheus_metrics: bool = Field(False, description="Expose Prometheus metrics endpoint")
    trace_requests: bool = Field(True, description="Enable request tracing")
    performance_metrics: bool = Field(True, description="Collect performance metrics")
    cost_tracking: bool = Field(True, description="Track API usage costs")
    log_latency: bool = Field(True, description="Log latency information for requests")
    token_counting: bool = Field(True, description="Count tokens for requests/responses")
    log_model_selection: bool = Field(True, description="Log model selection decisions")
    health_check_interval: int = Field(300, description="Model health check interval in seconds")
    alerting_enabled: bool = Field(False, description="Enable alerts for system issues")

class FallbackSettings(BaseSettings):
    """Settings for fallback behavior"""
    enabled: bool = Field(True, description="Enable fallback to alternative models")
    max_retries: int = Field(2, description="Maximum number of fallback attempts")
    retry_on_timeout: bool = Field(True, description="Retry on timeout errors")
    retry_on_rate_limit: bool = Field(True, description="Retry on rate limit errors")
    retry_on_server_error: bool = Field(True, description="Retry on 5xx errors")
    fallback_order: Dict[str, List[str]] = Field(
        default_factory=lambda: {
            "local": ["openai", "anthropic"],
            "openai": ["anthropic", "local"],
            "anthropic": ["openai", "local"]
        },
        description="Order of fallback models to try for each primary model"
    )
    fallback_threshold: float = Field(0.8, description="Confidence threshold below which to consider fallbacks")

class ApiSettings(BaseSettings):
    """Settings for API configuration"""
    app_name: str = Field("NeuroRoute", description="Application name")
    app_version: str = Field("0.1.0", description="Application version")
    app_description: str = Field(
        "Intelligent LLM Router API that forwards prompts to the best-suited LLM backend",
        description="Application description"
    )
    cors_origins: List[str] = Field(["*"], description="CORS allowed origins")
    max_request_size: int = Field(10 * 1024 * 1024, description="Maximum request size in bytes")
    default_request_timeout: float = Field(60.0, description="Default request timeout in seconds")
    health_check_interval: int = Field(300, description="Model health check interval in seconds")
    max_prompt_length: int = Field(100000, description="Maximum prompt length in characters")
    rate_limit_enabled: bool = Field(False, description="Enable rate limiting")
    rate_limit_requests: int = Field(100, description="Requests per rate limit window")
    rate_limit_window: int = Field(60, description="Rate limit window in seconds")
    enable_streaming: bool = Field(True, description="Enable streaming responses for supported models")
    enable_metrics: bool = Field(True, description="Enable metrics collection")
    default_model: str = Field("auto", description="Default model to use if not specified (use 'auto' for automatic selection)")
    auth_required: bool = Field(False, description="Require authentication for API requests")
    trusted_clients: List[str] = Field([], description="List of trusted client IDs that bypass rate limits")
    result_cache_enabled: bool = Field(True, description="Enable result caching")
    max_concurrent_requests: int = Field(100, description="Maximum concurrent requests to handle")
    enable_request_validation: bool = Field(True, description="Enable request validation")
    enable_model_health_checks: bool = Field(True, description="Enable periodic model health checks")

class LmStudioSettings(BaseSettings):
    """Settings for LM Studio local model"""
    host: str = Field("localhost", description="LM Studio host")
    port: int = Field(1234, description="LM Studio port")
    default_model: str = Field("mistral", description="Default model name")
    timeout: float = Field(30.0, description="Request timeout in seconds")
    max_tokens: int = Field(4096, description="Maximum tokens to generate")
    api_base: str = Field("", description="Custom API base URL (if empty, constructed from host and port)")
    system_prompt: Optional[str] = Field(None, description="Default system prompt")
    stop_sequences: List[str] = Field(default_factory=list, description="Default stop sequences")
    retry_attempts: int = Field(2, description="Number of retry attempts for failed requests")
    temperature: float = Field(0.7, description="Default temperature")
    
    @validator("api_base")
    def validate_api_base(cls, v, values):
        if not v and "host" in values and "port" in values:
            return f"http://{values['host']}:{values['port']}/v1"
        return v

class OpenAISettings(BaseSettings):
    """Settings for OpenAI models"""
    api_key: Optional[str] = Field(None, description="OpenAI API key")
    model: str = Field("gpt-4o", description="Default model to use")
    organization: Optional[str] = Field(None, description="OpenAI organization ID")
    timeout: float = Field(60.0, description="Request timeout in seconds")
    api_base: Optional[str] = Field(None, description="Custom API base URL")
    headers: Dict[str, str] = Field(default_factory=dict, description="Custom headers for API requests")
    retry_attempts: int = Field(2, description="Number of retry attempts for failed requests")
    temperature: float = Field(0.7, description="Default temperature")
    max_tokens: int = Field(4096, description="Maximum tokens to generate by default")
    system_prompt: Optional[str] = Field(None, description="Default system prompt")
    
    @validator("api_key")
    def validate_api_key(cls, v):
        if v is None or v.strip() == "":
            # We'll just issue a warning rather than an error to allow for optional setup
            return None
        if not v.startswith("sk-"):
            raise ValueError("OpenAI API key should start with 'sk-'")
        return v

class AnthropicSettings(BaseSettings):
    """Settings for Anthropic models"""
    api_key: Optional[str] = Field(None, description="Anthropic API key")
    model: str = Field("claude-3-sonnet-20240229", description="Default model to use")
    timeout: float = Field(120.0, description="Request timeout in seconds")
    api_base: Optional[str] = Field(None, description="Custom API base URL")
    headers: Dict[str, str] = Field(default_factory=dict, description="Custom headers for API requests")
    retry_attempts: int = Field(2, description="Number of retry attempts for failed requests")
    temperature: float = Field(0.7, description="Default temperature")
    max_tokens: int = Field(4096, description="Maximum tokens to generate by default")
    system_prompt: Optional[str] = Field(None, description="Default system prompt")
    
    @validator("api_key")
    def validate_api_key(cls, v):
        if v is None or v.strip() == "":
            # We'll just issue a warning rather than an error to allow for optional setup
            return None
        return v

class ModelCapability:
    """
    Enum-like class for model capabilities.
    Used for consistency in capability naming.
    """
    BASIC_CHAT = "basic_chat"
    CODE_GENERATION = "code_generation"
    MATH = "math"
    REASONING = "reasoning"
    SUMMARIZATION = "summarization"
    CREATIVE_WRITING = "creative_writing"
    DATA_ANALYSIS = "data_analysis"
    SYSTEM_DESIGN = "system_design"
    LONG_CONTEXT = "long_context"
    FUNCTION_CALLING = "function_calling"
    TEXT_EXTRACTION = "text_extraction"
    CLASSIFICATION = "classification"
    LEGAL_ANALYSIS = "legal_analysis"
    SCIENTIFIC_KNOWLEDGE = "scientific_knowledge"
    JSON_MODE = "json_mode"
    MULTILINGUAL = "multilingual"
    STRUCTURED_OUTPUT = "structured_output"
    TOOL_USE = "tool_use"
    IMAGE_UNDERSTANDING = "image_understanding"
    CODE_EXECUTION = "code_execution"
    RAG = "retrieval_augmented_generation"
    CONVERSATIONAL_MEMORY = "conversational_memory"
    FAST_RESPONSE = "fast_response"
    STEP_BY_STEP_REASONING = "step_by_step_reasoning"
    FILE_CREATION = "file_creation"

class Settings(BaseSettings):
    """
    Application settings using Pydantic BaseSettings for validation and loading from environment.
    Organized into nested setting groups for better structure.
    """
    # Nested settings
    log: LogSettings = Field(default_factory=LogSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    api: ApiSettings = Field(default_factory=ApiSettings)
    monitoring: MonitoringSettings = Field(default_factory=MonitoringSettings)
    fallback: FallbackSettings = Field(default_factory=FallbackSettings)
    lmstudio: LmStudioSettings = Field(default_factory=LmStudioSettings)
    openai: OpenAISettings = Field(default_factory=OpenAISettings)
    anthropic: AnthropicSettings = Field(default_factory=AnthropicSettings)
    
    # Legacy direct settings for backward compatibility
    # These will map to the nested settings and should be considered deprecated
    app_name: Optional[str] = None
    app_version: Optional[str] = None
    log_level: Optional[str] = None
    redis_enabled: Optional[bool] = None
    redis_host: Optional[str] = None
    redis_port: Optional[int] = None
    redis_ttl: Optional[int] = None
    lmstudio_host: Optional[str] = None
    lmstudio_port: Optional[int] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    anthropic_model: Optional[str] = None
    
    @root_validator(pre=True)
    def map_legacy_settings(cls, values):
        """Map legacy flat settings to the new nested structure if provided."""
        # Legacy to new mapping
        legacy_mappings = {
            # API settings
            "app_name": ("api", "app_name"),
            "app_version": ("api", "app_version"),
            "app_description": ("api", "app_description"),
            
            # Log settings
            "log_level": ("log", "log_level"),
            "log_format": ("log", "log_format"),
            "log_dir": ("log", "log_dir"),
            
            # Redis settings
            "redis_enabled": ("redis", "enabled"),
            "redis_host": ("redis", "host"),
            "redis_port": ("redis", "port"),
            "redis_ttl": ("redis", "ttl"),
            
            # LM Studio settings
            "lmstudio_host": ("lmstudio", "host"),
            "lmstudio_port": ("lmstudio", "port"),
            
            # OpenAI settings
            "openai_api_key": ("openai", "api_key"),
            "openai_model": ("openai", "model"),
            
            # Anthropic settings
            "anthropic_api_key": ("anthropic", "api_key"),
            "anthropic_model": ("anthropic", "model")
        }
        
        # Process legacy mappings
        for legacy_key, (section, new_key) in legacy_mappings.items():
            if legacy_key in values and values[legacy_key] is not None:
                # Create section if not exists
                if section not in values or not isinstance(values[section], dict):
                    values[section] = {}
                # Set value in the nested structure
                values[section][new_key] = values[legacy_key]
                
        return values

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
        "env_nested_delimiter": "__",  # This allows env vars like LOG__LEVEL=DEBUG
        "extra": "allow",  # Allow extra fields for backward compatibility
        "populate_by_name": True  # Allow population by field name as well as alias
    }

@lru_cache()
def get_settings():
    """
    Creates and returns the application settings.
    The @lru_cache decorator ensures this is only called once during the application lifetime.
    """
    settings = Settings()
    
    # Set up app_name and app_version in api section for backward compatibility
    if settings.app_name and not settings.api.app_name:
        settings.api.app_name = settings.app_name
    
    if settings.app_version and not settings.api.app_version:
        settings.api.app_version = settings.app_version
        
    return settings

# Build model registry from settings
def get_model_registry(settings: Settings) -> Dict[str, Dict[str, Any]]:
    """
    Build the model registry from application settings.
    This allows for a cleaner initialization and dependency injection pattern.
    """
    return {
        "local": {
            "name": "local-lmstudio",
            "provider": "lmstudio",
            "model_id": settings.lmstudio.default_model,
            "capabilities": [
                ModelCapability.BASIC_CHAT,
                ModelCapability.MATH,
                ModelCapability.FAST_RESPONSE,
                ModelCapability.FILE_CREATION
            ],
            "avg_latency_ms": 500,  # Estimated average latency
            "cost_per_1k_tokens": 0.0,
            "max_tokens": settings.lmstudio.max_tokens,
            "supports_streaming": True,
            "priority": {
                "speed": 1,  # High priority for speed (1 is highest)
                "cost": 1,   # High priority for cost
                "quality": 3  # Low priority for quality
            },
            "max_prompt_length": 4000,
            "adapter_class": "LocalLmStudioAdapter",
            "fallback_models": ["openai"],  # Models to try if this one fails
            "health_check_interval": 600,  # Check health every 10 minutes
            "description": "Local LM Studio model - fastest and cheapest, good for simple tasks",
            "config": {
                "host": settings.lmstudio.host,
                "port": settings.lmstudio.port,
                "url": f"http://{settings.lmstudio.host}:{settings.lmstudio.port}/v1",
                "timeout": settings.lmstudio.timeout,
                "temperature": settings.lmstudio.temperature,
                "system_prompt": settings.lmstudio.system_prompt,
                "stop_sequences": settings.lmstudio.stop_sequences,
                "retry_attempts": settings.lmstudio.retry_attempts
            }
        },
        "openai": {
            "name": "gpt-4o",
            "provider": "openai",
            "model_id": settings.openai.model,
            "capabilities": [
                ModelCapability.BASIC_CHAT,
                ModelCapability.CODE_GENERATION, 
                ModelCapability.REASONING,
                ModelCapability.SUMMARIZATION,
                ModelCapability.DATA_ANALYSIS,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.JSON_MODE,
                ModelCapability.STRUCTURED_OUTPUT,
                ModelCapability.TOOL_USE,
                ModelCapability.MULTILINGUAL,
                ModelCapability.STEP_BY_STEP_REASONING
            ],
            "avg_latency_ms": 2000,  # Estimated average latency
            "cost_per_1k_tokens": 0.01,  # Simplified for demonstration
            "max_tokens": 128000,
            "supports_streaming": True,
            "priority": {
                "speed": 2,  # Medium priority for speed
                "cost": 2,   # Medium priority for cost
                "quality": 1  # High priority for quality
            },
            "max_prompt_length": 100000,
            "adapter_class": "OpenAIAdapter",
            "fallback_models": ["anthropic"],  # Models to try if this one fails
            "health_check_interval": 300,  # Check health every 5 minutes
            "description": "OpenAI GPT-4o - balanced performance, good for coding and technical tasks",
            "config": {
                "api_key": settings.openai.api_key,
                "model": settings.openai.model,
                "organization": settings.openai.organization,
                "timeout": settings.openai.timeout,
                "api_base": settings.openai.api_base,
                "headers": settings.openai.headers,
                "temperature": settings.openai.temperature,
                "max_tokens": settings.openai.max_tokens,
                "system_prompt": settings.openai.system_prompt,
                "retry_attempts": settings.openai.retry_attempts
            }
        },
        "anthropic": {
            "name": "claude-3-sonnet",
            "provider": "anthropic",
            "model_id": settings.anthropic.model,
            "capabilities": [
                ModelCapability.BASIC_CHAT,
                ModelCapability.LONG_CONTEXT,
                ModelCapability.LEGAL_ANALYSIS,
                ModelCapability.REASONING,
                ModelCapability.CREATIVE_WRITING,
                ModelCapability.SCIENTIFIC_KNOWLEDGE,
                ModelCapability.MULTILINGUAL,
                ModelCapability.IMAGE_UNDERSTANDING,
                ModelCapability.STRUCTURED_OUTPUT,
                ModelCapability.STEP_BY_STEP_REASONING
            ],
            "avg_latency_ms": 3000,  # Estimated average latency
            "cost_per_1k_tokens": 0.015,  # Simplified for demonstration
            "max_tokens": 200000,
            "supports_streaming": True,
            "priority": {
                "speed": 3,  # Low priority for speed
                "cost": 3,   # Low priority for cost
                "quality": 1  # High priority for quality (tied with OpenAI)
            },
            "max_prompt_length": 150000,
            "adapter_class": "AnthropicAdapter",
            "fallback_models": ["openai"],  # Models to try if this one fails
            "health_check_interval": 300,  # Check health every 5 minutes
            "description": "Anthropic Claude 3 Sonnet - highest quality for complex reasoning, legal, scientific and creative tasks",
            "config": {
                "api_key": settings.anthropic.api_key,
                "model": settings.anthropic.model,
                "timeout": settings.anthropic.timeout,
                "api_base": settings.anthropic.api_base,
                "headers": settings.anthropic.headers,
                "temperature": settings.anthropic.temperature,
                "max_tokens": settings.anthropic.max_tokens,
                "system_prompt": settings.anthropic.system_prompt,
                "retry_attempts": settings.anthropic.retry_attempts
            }
        }
    }

# Create a function to get Redis config from settings
def get_redis_config(settings: Settings) -> Dict[str, Any]:
    """Get Redis configuration from settings."""
    # Convert Pydantic settings to dict for compatibility
    return settings.redis.dict()

# Create a function to get logging config from settings
def get_log_config(settings: Settings) -> Dict[str, Any]:
    """Get logging configuration from settings."""
    # Convert Pydantic settings to dict for compatibility
    return settings.log.model_dump()

# Create a function to get monitoring config from settings
def get_monitoring_config(settings: Settings) -> Dict[str, Any]:
    """Get monitoring configuration from settings."""
    # Convert Pydantic settings to dict for compatibility
    return settings.monitoring.dict()

# Create a function to get fallback config from settings
def get_fallback_config(settings: Settings) -> Dict[str, Any]:
    """Get fallback configuration from settings."""
    # Convert Pydantic settings to dict for compatibility
    return settings.fallback.dict()

# Get adapter class for a model
def get_adapter_class_for_model(model_key: str) -> str:
    """Get the adapter class name for a specific model."""
    registry = get_model_registry(get_settings())
    if model_key in registry:
        return registry[model_key].get("adapter_class", "ModelAdapter")
    return "ModelAdapter"  # Default base adapter

# For backwards compatibility, we'll provide the old-style constants
# These will be deprecated in future versions
MODEL_REGISTRY = get_model_registry(get_settings())
REDIS_CONFIG = get_redis_config(get_settings())
LOG_CONFIG = get_log_config(get_settings())
MONITORING_CONFIG = get_monitoring_config(get_settings())
FALLBACK_CONFIG = get_fallback_config(get_settings())

# Helper function to convert log level string to logging module constant
def get_log_level(level_str: str) -> int:
    """Convert a string log level to the corresponding logging module constant."""
    level_map = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL
    }
    return level_map.get(level_str.lower(), logging.INFO)

# Helper function to check if a model supports a specific capability
def model_supports_capability(model_key: str, capability: str) -> bool:
    """Check if a model supports a specific capability."""
    registry = get_model_registry(get_settings())
    if model_key in registry:
        return capability in registry[model_key].get("capabilities", [])
    return False

# Helper function to get models by capability
def get_models_by_capability(capability: str) -> List[str]:
    """Get a list of models that support a specific capability."""
    registry = get_model_registry(get_settings())
    return [
        model_key for model_key, config in registry.items()
        if capability in config.get("capabilities", [])
    ]

# Helper function to get model description
def get_model_description(model_key: str) -> str:
    """Get the description for a specific model."""
    registry = get_model_registry(get_settings())
    if model_key in registry:
        return registry[model_key].get("description", "No description available")
    return "Unknown model"