import hashlib
import json
import time
from typing import Optional, Dict, Any
import redis
from redis.asyncio import Redis
from config import get_settings, get_redis_config, Settings
# No need to import utils.logger as we're using self.logger


class Cache:
    """
    Redis cache wrapper for NeuroRoute providing async cache operations.
    Supports cached model responses with flexible TTL and metadata-sensitive caching.
    """

    def __init__(self, logger: Any, settings: Optional[Settings] = None):
        """
        Initialize Redis connection if enabled.

        Args:
            logger: The logger instance to use.
            settings: Application settings. If None, will use get_settings()
        """
        self.logger = logger
        # Use provided settings or get from default
        self.settings = settings or get_settings()
        redis_config = get_redis_config(self.settings)

        self.enabled = redis_config["enabled"]
        self.async_client = None
        self.sync_client = None  # For operations that don't need async
        self.ttl = redis_config["ttl"]
        self.prefix = redis_config.get("key_prefix", "neuroroute:")
        self.redis_config = redis_config
        self.connection_errors = 0
        self.max_retries = redis_config.get("max_retries", 3)
        self.last_connection_attempt = 0
        self.reconnect_delay = redis_config.get(
            "reconnect_delay", 5)  # seconds

        # Initialize connections if cache is enabled
        if self.enabled:
            self._initialize_connections()

    def _initialize_connections(self):
        """Initialize both sync and async Redis clients."""
        try:
            # Initialize async client
            self.async_client = Redis(
                host=self.redis_config["host"],
                port=self.redis_config["port"],
                db=self.redis_config.get("db", 0),
                password=self.redis_config.get("password"),
                decode_responses=True,
                socket_timeout=self.redis_config.get("timeout", 3),
                socket_connect_timeout=self.redis_config.get(
                    "connect_timeout", 3)
            )

            # Initialize sync client
            self.sync_client = redis.Redis(
                host=self.redis_config["host"],
                port=self.redis_config["port"],
                db=self.redis_config.get("db", 0),
                password=self.redis_config.get("password"),
                decode_responses=True,
                socket_timeout=self.redis_config.get("timeout", 3),
                socket_connect_timeout=self.redis_config.get(
                    "connect_timeout", 3)
            )

            # Test connection with sync client
            self.sync_client.ping()

            self.logger.info("Redis cache initialized successfully.")
            self.connection_errors = 0
            self.last_connection_attempt = time.time()

        except redis.exceptions.ConnectionError as e:
            self.logger.warning(
                f"Failed to connect to Redis: {e}. Cache will be disabled.")
            self.enabled = False
            self.async_client = None
            self.sync_client = None
            self.connection_errors += 1
            self.last_connection_attempt = time.time()

        except Exception as e:
            self.logger.error(f"Redis initialization error: {e}")
            self.enabled = False
            self.async_client = None
            self.sync_client = None
            self.connection_errors += 1
            self.last_connection_attempt = time.time()

    async def _ensure_connection(self) -> bool:
        """
        Check and attempt to restore Redis connection if needed.

        Returns:
            bool: Whether a valid connection is available
        """
        # If the cache is disabled by config, don't try to connect
        if not self.enabled:
            return False

        # If the connection is already established, return True
        if self.async_client is not None and self.sync_client is not None:
            try:
                # Quick ping test to verify connection
                await self.async_client.ping()
                return True
            except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
                # Connection lost, will attempt to reconnect
                pass

        # Check if we should attempt reconnection
        now = time.time()
        if (now - self.last_connection_attempt < self.reconnect_delay or
                self.connection_errors >= self.max_retries):
            return False

        # Try to reconnect
        self.logger.info("Attempting to reconnect to Redis...")
        self._initialize_connections()

        return self.async_client is not None and self.sync_client is not None

    def _generate_key(self, prompt: str, metadata: Dict[str, Any] = None) -> str:
        """
        Generate a consistent hash key for the prompt and metadata.

        Args:
            prompt: The user prompt
            metadata: Optional metadata for the request

        Returns:
            A hash string to use as cache key
        """
        if metadata is None:
            metadata = {}

        # Create a filtered metadata dict with only the cache-relevant fields
        cache_relevant_fields = {
            "model", "temperature", "max_tokens", "user_id",
            "priority", "language", "stream"
        }

        # Filter metadata to only include cache-relevant fields
        filtered_metadata = {
            k: v for k, v in metadata.items() if k in cache_relevant_fields}

        # Add model forcing if specified
        if "model" in metadata:
            filtered_metadata["forced_model"] = metadata["model"]

        # Create a consistent string representation of the prompt and filtered metadata
        cache_data = {
            "prompt": prompt,
            "metadata": filtered_metadata
        }

        # Log the filtered metadata to inspect its contents
        self.logger.debug(
            f"Filtered metadata for cache key: {filtered_metadata}")

        serialized = json.dumps(cache_data, sort_keys=True)
        key_hash = hashlib.sha256(serialized.encode()).hexdigest()

        # Add model prefix if metadata includes model info
        model_prefix = ""
        if "model" in metadata:
            model_prefix = f"{metadata['model']}:"

        return f"{self.prefix}{model_prefix}{key_hash}"

    async def get(self, prompt: str, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Check if a response is cached for the given prompt and metadata.

        Args:
            prompt: The user prompt
            metadata: Optional metadata associated with the prompt

        Returns:
            The cached response or None if not found
        """
        # Log the metadata received by the get method
        self.logger.debug(f"Cache get received metadata: {metadata}")

        # Skip if cache is disabled
        if not await self._ensure_connection():
            return None

        key = self._generate_key(prompt, metadata)

        try:
            cached = await self.async_client.get(key)
            if cached:
                self.logger.debug(f"Cache hit for key: {key[:10]}...")
                cached_data = json.loads(cached)
                # Add cache metadata
                cached_data["from_cache"] = True
                cached_data["cache_key"] = key
                return cached_data

            self.logger.debug(f"Cache miss for key: {key[:10]}...")
            return None

        except Exception as e:
            self.logger.error(f"Redis get error: {e}")
            return None

    async def set(self, prompt: str, response: Dict[str, Any], metadata: Dict[str, Any] = None) -> bool:
        """
        Cache a response for the given prompt and metadata.

        Args:
            prompt: The user prompt
            response: The response to cache
            metadata: Optional metadata associated with the prompt

        Returns:
            True if cached successfully, False otherwise
        """
        # Skip if cache is disabled
        if not await self._ensure_connection():
            return False

        key = self._generate_key(prompt, metadata)

        try:
            # Remove cached-related flags from the stored data
            response_to_cache = response.copy()
            for field in ["from_cache", "cache_key", "cache_latency_ms"]:
                if field in response_to_cache:
                    del response_to_cache[field]

            # Set TTL based on metadata if provided
            ttl = metadata.get("cache_ttl", self.ttl) if metadata else self.ttl

            # Don't cache errors or fallbacks
            if response_to_cache.get("error", False) or response_to_cache.get("fallback", False):
                self.logger.debug("Skipping cache for error/fallback response")
                return False

            # Store serialized response with TTL
            serialized = json.dumps(response_to_cache)
            await self.async_client.setex(key, ttl, serialized)

            # Store key in model set for easier model-specific operations
            model_used = response_to_cache.get("model_used")
            if model_used:
                model_set_key = f"{self.prefix}models:{model_used}"
                await self.async_client.sadd(model_set_key, key)

            self.logger.debug(
                f"Cached response for key: {key[:10]}... with TTL: {ttl}s")
            return True

        except Exception as e:
            self.logger.error(f"Redis set error: {e}")
            return False

    async def clear(self, model: Optional[str] = None) -> int:
        """
        Clear cached responses.

        Args:
            model: Optional model key to clear only that model's cached responses

        Returns:
            Number of cleared cache entries
        """
        # Skip if cache is disabled
        if not await self._ensure_connection():
            return 0

        try:
            cleared_count = 0

            if model:
                # Clear model-specific cache
                model_set_key = f"{self.prefix}models:{model}"
                # Get all keys for this model
                model_keys = await self.async_client.smembers(model_set_key)

                if model_keys:
                    # Delete all keys
                    deleted = await self.async_client.delete(*model_keys)
                    cleared_count = deleted
                    # Delete the set itself
                    await self.async_client.delete(model_set_key)

                self.logger.info(
                    f"Cleared {cleared_count} cached responses for model {model}.")
            else:
                # Clear all cache
                # Get all keys with our prefix
                cursor = 0
                all_keys = set()

                # Use scan for better performance with large datasets
                while True:
                    cursor, keys = await self.async_client.scan(cursor, match=f"{self.prefix}*", count=1000)
                    all_keys.update(keys)
                    if cursor == 0:
                        break

                if all_keys:
                    # Delete in batches to avoid blocking Redis
                    batch_size = 1000
                    for i in range(0, len(all_keys), batch_size):
                        batch = list(all_keys)[i:i+batch_size]
                        deleted = await self.async_client.delete(*batch)
                        cleared_count += deleted

                self.logger.info(f"Cleared {cleared_count} cached responses.")

            return cleared_count

        except Exception as e:
            self.logger.error(f"Redis clear error: {e}")
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dict with cache statistics
        """
        # Skip if cache is disabled
        if not await self._ensure_connection():
            return {
                "enabled": False,
                "entries": 0,
                "models": {},
                "memory_usage_bytes": 0
            }

        try:
            # Get memory usage
            info = await self.async_client.info("memory")
            memory_usage = int(info.get("used_memory", 0))

            # Count all cached entries
            cursor = 0
            all_keys = set()

            # Use scan for better performance with large datasets
            while True:
                cursor, keys = await self.async_client.scan(cursor, match=f"{self.prefix}*", count=1000)
                # Filter out model set keys
                entry_keys = [k for k in keys if not k.startswith(
                    f"{self.prefix}models:")]
                all_keys.update(entry_keys)
                if cursor == 0:
                    break

            # Count entries per model
            model_stats = {}
            # Get all model set keys
            cursor = 0
            model_set_keys = set()

            while True:
                cursor, keys = await self.async_client.scan(cursor, match=f"{self.prefix}models:*", count=100)
                model_set_keys.update(keys)
                if cursor == 0:
                    break

            # Get counts for each model
            for model_key in model_set_keys:
                model_name = model_key.split(":")[-1]
                count = await self.async_client.scard(model_key)
                model_stats[model_name] = count

            return {
                "enabled": True,
                "entries": len(all_keys),
                "models": model_stats,
                "memory_usage_bytes": memory_usage,
                "ttl_seconds": self.ttl
            }

        except Exception as e:
            self.logger.error(f"Redis stats error: {e}")
            return {
                "enabled": False,
                "error": str(e),
                "entries": 0,
                "models": {},
                "memory_usage_bytes": 0
            }

    async def close(self):
        """Close Redis connections if open."""
        # Close async client
        if self.async_client:
            try:
                await self.async_client.close()
            except Exception as e:
                self.logger.error(f"Error closing async Redis connection: {e}")

        # Close sync client
        if self.sync_client:
            try:
                self.sync_client.close()
            except Exception as e:
                self.logger.error(f"Error closing sync Redis connection: {e}")

        self.logger.info("Redis connections closed.")


# Singleton instance for better performance
_cache_instances: Dict[str, Cache] = {}


def get_cache(logger: Any, settings: Optional[Settings] = None) -> Cache:
    """
    Factory function to create or return cached Cache instance based on settings.
    This integrates well with FastAPI dependency injection.

    Args:
        logger: The logger instance to use.
        settings: Optional settings to initialize cache with. If None, uses default settings.

    Returns:
        Cache instance
    """
    # Use provided settings or get from default
    current_settings = settings or get_settings()
    redis_config = get_redis_config(current_settings)

    # Generate a hashable key from the relevant redis configuration
    # Sort keys to ensure consistent hashing
    config_string = json.dumps(redis_config, sort_keys=True)
    cache_key = hashlib.sha256(config_string.encode()).hexdigest()

    # Access the module-level _cache_instances dictionary
    if cache_key not in _cache_instances:
        _cache_instances[cache_key] = Cache(logger, current_settings)

    return _cache_instances[cache_key]
