import { FastifyInstance } from 'fastify';

// Cache service options
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

// Cache service
export class CacheService {
  private fastify: FastifyInstance;
  private options: Required<CacheOptions>;

  constructor(fastify: FastifyInstance, options: CacheOptions = {}) {
    this.fastify = fastify;
    this.options = {
      ttl: options.ttl ?? 3600, // Default: 1 hour
      prefix: options.prefix ?? 'neuroroute:cache:',
    };
  }

  /**
   * Generate a cache key
   * @param parts Key parts to combine
   * @returns The cache key
   */
  generateKey(...parts: string[]): string {
    return `${this.options.prefix}${parts.join(':')}`;
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.fastify.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Cache get failed');
      return null;
    }
  }

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Optional custom TTL in seconds
   * @returns Success status
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const expiry = ttl ?? this.options.ttl;
      const serialized = JSON.stringify(value);
      
      await this.fastify.redis.set(key, serialized, 'EX', expiry);
      return true;
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Cache set failed');
      return false;
    }
  }

  /**
   * Delete a value from the cache
   * @param key The cache key
   * @returns Success status
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.fastify.redis.del(key);
      return true;
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Cache delete failed');
      return false;
    }
  }

  /**
   * Clear all cache entries with the configured prefix
   * @returns Success status
   */
  async clear(): Promise<boolean> {
    try {
      const keys = await this.fastify.redis.keys(`${this.options.prefix}*`);
      if (keys.length > 0) {
        await this.fastify.redis.del(...keys);
      }
      return true;
    } catch (error) {
      this.fastify.log.error(error, 'Cache clear failed');
      return false;
    }
  }

  /**
   * Get cache stats
   * @returns Cache statistics
   */
  async getStats() {
    try {
      const keys = await this.fastify.redis.keys(`${this.options.prefix}*`);
      return {
        count: keys.length,
        keys: keys.slice(0, 10), // Return first 10 keys for debugging
      };
    } catch (error) {
      this.fastify.log.error(error, 'Get cache stats failed');
      return {
        count: 0,
        keys: [],
      };
    }
  }
}

// Factory function to create a cache service
export function createCacheService(
  fastify: FastifyInstance,
  options?: CacheOptions
) {
  return new CacheService(fastify, options);
}

export default createCacheService;