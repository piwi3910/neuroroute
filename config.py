import os
from dotenv import load_dotenv
from typing import Dict, Any, List

# Load environment variables
load_dotenv()

# LLM Model Registry with capabilities and metadata
MODEL_REGISTRY = {
    "local": {
        "name": "local-lmstudio",
        "provider": "lmstudio",
        "capabilities": ["basic", "chat", "simple_math", "file_creation"],
        "avg_latency_ms": 500,  # Estimated average latency
        "cost_per_1k_tokens": 0.0,
        "max_tokens": 4096,
        "supports_streaming": True,
        "config": {
            "host": os.getenv("LMSTUDIO_HOST", "localhost"),
            "port": int(os.getenv("LMSTUDIO_PORT", "1234")),
            "url": f"http://{os.getenv('LMSTUDIO_HOST', 'localhost')}:{os.getenv('LMSTUDIO_PORT', '1234')}/v1"
        }
    },
    "openai": {
        "name": "gpt-4-turbo",
        "provider": "openai",
        "capabilities": ["analysis", "code", "summarization", "comparison", "complex_reasoning"],
        "avg_latency_ms": 2000,  # Estimated average latency
        "cost_per_1k_tokens": 0.01,  # Simplified for demonstration
        "max_tokens": 128000,
        "supports_streaming": True,
        "config": {
            "api_key": os.getenv("OPENAI_API_KEY"),
            "model": "gpt-4o",
        }
    },
    "anthropic": {
        "name": "claude-3-sonnet",
        "provider": "anthropic",
        "capabilities": ["long_document", "legal", "detailed_reasoning", "analysis"],
        "avg_latency_ms": 3000,  # Estimated average latency
        "cost_per_1k_tokens": 0.015,  # Simplified for demonstration
        "max_tokens": 200000,
        "supports_streaming": True,
        "config": {
            "api_key": os.getenv("ANTHROPIC_API_KEY"),
            "model": "claude-3-sonnet-20240229",
        }
    }
}

# Keywords for intent classification (simplified rule-based approach)
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

# Redis configuration
REDIS_CONFIG = {
    "enabled": os.getenv("REDIS_ENABLED", "false").lower() == "true",
    "host": os.getenv("REDIS_HOST", "localhost"),
    "port": int(os.getenv("REDIS_PORT", "6379")),
    "ttl": int(os.getenv("REDIS_TTL", "600"))  # 10 minutes in seconds
}

# Logging configuration
LOG_CONFIG = {
    "level": os.getenv("LOG_LEVEL", "INFO"),
    "format": "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    "log_dir": "logs"
}