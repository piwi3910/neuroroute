import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

/**
 * Cache service options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  hashKeys?: boolean; // Whether to hash keys
  compression?: boolean; // Whether to compress values
  namespace?: string; // Namespace for keys
}

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

/**
 * Cache service for storing and retrieving data from Redis
 */
export class CacheService {
  private fastify: FastifyInstance;
  private options: Required<CacheOptions>;
  private enabled: boolean;

  /**
   * Create a new cache service
   *
   * @param fastify Fastify instance
   * @param options Cache options
   */
  constructor(fastify: FastifyInstance, options: CacheOptions = {}) {
    this.fastify = fastify;
    
    // Get TTL from config if available
    const configTtl = fastify.config?.REDIS_CACHE_TTL;
    
    this.options = {
      ttl: options.ttl ?? configTtl ?? 3600, // Default: 1 hour
      prefix: options.prefix ?? 'neuroroute:cache:',
      hashKeys: options.hashKeys ?? true,
      compression: options.compression ?? false,
      namespace: options.namespace ?? '',
    };
    
    // Check if caching is enabled in config
    this.enabled = fastify.config?.ENABLE_CACHE ?? true;
    
    // Log initialization
    this.fastify.log.debug({
      cacheEnabled: this.enabled,
      cacheTtl: this.options.ttl,
      cachePrefix: this.options.prefix,
      cacheNamespace: this.options.namespace || 'default'
    }, 'Cache service initialized');
  }

  /**
   * Generate a cache key
   *
   * @param parts Key parts to combine
   * @returns The cache key
   */
  generateKey(...parts: string[]): string {
    const baseKey = `${this.options.namespace ? this.options.namespace + ':' : ''}${parts.join(':')}`;
    
    // Hash the key if enabled
    if (this.options.hashKeys) {
      const hash = crypto.createHash('sha256').update(baseKey).digest('hex').substring(0, 16);
      return `${this.options.prefix}${hash}`;
    }
    
    return `${this.options.prefix}${baseKey}`;
  }

  /**
   * Get a value from the cache
   *
   * @param key The cache key
   * @returns The cached value or null
   */
  async get<T>(key: string): Promise<T | null> {
    // Return null if caching is disabled
    if (!this.enabled) {
      return null;
    }
    
    try {
      // Check if Redis is available
      if (!this.fastify.redis) {
        this.fastify.log.warn('Redis not available for cache get operation');
        return null;
      }
      
      const value = await this.fastify.redis.get(key);
      if (!value) return null;
      
      // Parse the cache entry
      const entry = JSON.parse(value) as CacheEntry<T>;
      
      // Check if the entry has expired
      if (entry.expiresAt < Date.now()) {
        // Delete expired entry
        await this.delete(key);
        return null;
      }
      
      this.fastify.log.debug({ key, age: (Date.now() - entry.createdAt) / 1000 }, 'Cache hit');
      return entry.value;
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Cache get failed');
      return null;
    }
  }

  /**
   * Set a value in the cache
   *
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Optional custom TTL in seconds
   * @param metadata Optional metadata to store with the value
   * @returns Success status
   */
  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    // Return false if caching is disabled
    if (!this.enabled) {
      return false;
    }
    
    try {
      // Check if Redis is available
      if (!this.fastify.redis) {
        this.fastify.log.warn('Redis not available for cache set operation');
        return false;
      }
      
      const now = Date.now();
      const expiry = ttl ?? this.options.ttl;
      
      // Create cache entry with metadata
      const entry: CacheEntry<T> = {
        value,
        createdAt: now,
        expiresAt: now + expiry * 1000,
        metadata,
      };
      
      const serialized = JSON.stringify(entry);
      
      // Set with expiry
      await this.fastify.redis.set(key, serialized, 'EX', expiry);
      
      this.fastify.log.debug({ key, ttl: expiry }, 'Cache set');
      return true;
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Cache set failed');
      return false;
    }
  }

  /**
   * Delete a value from the cache
   *
   * @param key The cache key
   * @returns Success status
   */
  async delete(key: string): Promise<boolean> {
    // Return false if caching is disabled
    if (!this.enabled) {
      return false;
    }
    
    try {
      // Check if Redis is available
      if (!this.fastify.redis) {
        this.fastify.log.warn('Redis not available for cache delete operation');
        return false;
      }
      
      await this.fastify.redis.del(key);
      
      this.fastify.log.debug({ key }, 'Cache delete');
      return true;
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Cache delete failed');
      return false;
    }
  }

  /**
   * Clear all cache entries with the configured prefix
   *
   * @returns Success status
   */
  async clear(): Promise<boolean> {
    // Return false if caching is disabled
    if (!this.enabled) {
      return false;
    }
    
    try {
      // Check if Redis is available
      if (!this.fastify.redis) {
        this.fastify.log.warn('Redis not available for cache clear operation');
        return false;
      }
      
      const pattern = `${this.options.prefix}${this.options.namespace ? this.options.namespace + ':*' : '*'}`;
      const keys = await this.fastify.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.fastify.redis.del(...keys);
        this.fastify.log.info({ count: keys.length, pattern }, 'Cache cleared');
      } else {
        this.fastify.log.debug({ pattern }, 'No cache entries to clear');
      }
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, 'Cache clear failed');
      return false;
    }
  }

  /**
   * Get cache stats
   *
   * @returns Cache statistics
   */
  async getStats() {
    // Return empty stats if caching is disabled
    if (!this.enabled) {
      return {
        enabled: false,
        count: 0,
        keys: [],
        memory: 0,
      };
    }
    
    try {
      // Check if Redis is available
      if (!this.fastify.redis) {
        this.fastify.log.warn('Redis not available for cache stats operation');
        return {
          enabled: true,
          count: 0,
          keys: [],
          memory: 0,
          error: 'Redis not available',
        };
      }
      
      const pattern = `${this.options.prefix}${this.options.namespace ? this.options.namespace + ':*' : '*'}`;
      const keys = await this.fastify.redis.keys(pattern);
      
      // Get memory usage if available
      let memory = 0;
      try {
        const info = await this.fastify.redis.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          memory = parseInt(match[1], 10);
        }
      } catch (error) {
        // Ignore memory info errors
      }
      
      return {
        enabled: this.enabled,
        count: keys.length,
        keys: keys.slice(0, 10), // Return first 10 keys for debugging
        memory,
        prefix: this.options.prefix,
        namespace: this.options.namespace || 'default',
        ttl: this.options.ttl,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Get cache stats failed');
      return {
        enabled: this.enabled,
        count: 0,
        keys: [],
        memory: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Factory function to create a cache service
 *
 * @param fastify Fastify instance
 * @param options Cache options
 * @returns Cache service instance
 */
export function createCacheService(
  fastify: FastifyInstance,
  options?: CacheOptions
): CacheService {
  return new CacheService(fastify, options);
}

export default createCacheService;