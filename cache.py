import hashlib
import json
from typing import Optional, Dict, Any
import redis
from loguru import logger
from config import REDIS_CONFIG

class Cache:
    """Redis cache wrapper for NeuroRoute."""
    
    def __init__(self):
        """Initialize Redis connection if enabled."""
        self.enabled = REDIS_CONFIG["enabled"]
        self.client = None
        self.ttl = REDIS_CONFIG["ttl"]
        
        if self.enabled:
            try:
                self.client = redis.Redis(
                    host=REDIS_CONFIG["host"],
                    port=REDIS_CONFIG["port"],
                    decode_responses=True
                )
                # Test connection
                self.client.ping()
                logger.info("Redis cache initialized successfully.")
            except redis.exceptions.ConnectionError:
                logger.warning("Failed to connect to Redis. Cache will be disabled.")
                self.enabled = False
                self.client = None
        else:
            logger.info("Redis cache is disabled by configuration.")
    
    def _generate_key(self, prompt: str, metadata: Dict[str, Any] = None) -> str:
        """Generate a consistent hash key for the prompt and metadata."""
        if metadata is None:
            metadata = {}
        
        # Create a consistent string representation of the prompt and metadata
        cache_data = {
            "prompt": prompt,
            "metadata": metadata
        }
        
        serialized = json.dumps(cache_data, sort_keys=True)
        return f"neuroroute:{hashlib.sha256(serialized.encode()).hexdigest()}"
    
    def get(self, prompt: str, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Check if a response is cached for the given prompt and metadata.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata associated with the prompt
            
        Returns:
            The cached response or None if not found
        """
        if not self.enabled or not self.client:
            return None
            
        key = self._generate_key(prompt, metadata)
        
        try:
            cached = self.client.get(key)
            if cached:
                logger.info(f"Cache hit for key: {key[:10]}...")
                return json.loads(cached)
            logger.debug(f"Cache miss for key: {key[:10]}...")
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    def set(self, prompt: str, response: Dict[str, Any], metadata: Dict[str, Any] = None) -> bool:
        """
        Cache a response for the given prompt and metadata.
        
        Args:
            prompt: The user prompt
            response: The response to cache
            metadata: Optional metadata associated with the prompt
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self.enabled or not self.client:
            return False
            
        key = self._generate_key(prompt, metadata)
        
        try:
            serialized = json.dumps(response)
            self.client.setex(key, self.ttl, serialized)
            logger.info(f"Cached response for key: {key[:10]}... with TTL: {self.ttl}s")
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

# Singleton instance
cache = Cache()