import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import crypto from 'crypto';

interface CacheOptions {
  // Enable/disable caching
  enabled?: boolean;
  
  // Default TTL in seconds
  ttl?: number;
  
  // Cache prefix
  prefix?: string;
  
  // Cache strategies
  strategies?: {
    // Cache by URL path
    byPath?: boolean;
    
    // Cache by query parameters
    byQueryParams?: boolean;
    
    // Cache by request headers
    byHeaders?: string[];
    
    // Cache by user/API key
    byUser?: boolean;
    
    // Cache by content type
    byContentType?: boolean;
  };
  
  // Cache exclusions
  exclude?: {
    // Paths to exclude (regex patterns)
    paths?: string[];
    
    // Methods to exclude
    methods?: string[];
    
    // Status codes to exclude
    statusCodes?: number[];
  };
  
  // Cache storage type
  storage?: 'redis' | 'memory';
  
  // Compression options
  compression?: {
    enabled?: boolean;
    minSize?: number; // Minimum size in bytes to compress
  };
  
  // Cache invalidation options
  invalidation?: {
    // Automatic invalidation by model/entity
    models?: {
      [key: string]: string[]; // Model name -> cache patterns to invalidate
    };
  };
}

// Default options
const defaultOptions: CacheOptions = {
  enabled: true,
  ttl: 300, // 5 minutes
  prefix: 'cache:',
  strategies: {
    byPath: true,
    byQueryParams: true,
    byHeaders: ['accept-language'],
    byUser: false,
    byContentType: true,
  },
  exclude: {
    paths: ['^/health', '^/metrics', '^/admin'],
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    statusCodes: [400, 401, 403, 404, 500],
  },
  storage: 'redis',
  compression: {
    enabled: true,
    minSize: 1024, // 1KB
  },
  invalidation: {
    models: {},
  },
};

// Memory cache store
class MemoryCacheStore {
  private cache: Map<string, { value: string; expires: number }>;
  
  constructor() {
    this.cache = new Map();
  }
  
  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if expired
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }
  
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async delByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// Redis cache store
class RedisCacheStore {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttl);
  }
  
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
  
  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  async clear(): Promise<void> {
    // Only clear keys with our prefix to avoid deleting other data
    const keys = await this.redis.keys('cache:*');
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Compress and decompress data
const compressData = (data: string): string => {
  return Buffer.from(data).toString('base64');
};

const decompressData = (data: string): string => {
  return Buffer.from(data, 'base64').toString();
};

// Generate cache key
const generateCacheKey = (
  request: FastifyRequest,
  options: CacheOptions
): string => {
  const parts: string[] = [options.prefix!];
  
  // Add path
  if (options.strategies?.byPath) {
    parts.push(request.url);
  }
  
  // Add query parameters
  if (options.strategies?.byQueryParams && Object.keys(request.query || {}).length > 0) {
    parts.push(JSON.stringify(request.query));
  }
  
  // Add headers
  if (options.strategies?.byHeaders && options.strategies.byHeaders.length > 0) {
    const headers: Record<string, string> = {};
    
    for (const header of options.strategies.byHeaders) {
      const value = request.headers[header];
      
      if (value) {
        headers[header] = Array.isArray(value) ? value.join(',') : value.toString();
      }
    }
    
    if (Object.keys(headers).length > 0) {
      parts.push(JSON.stringify(headers));
    }
  }
  
  // Add user/API key
  if (options.strategies?.byUser) {
    const apiKey = request.headers['x-api-key'] || 'anonymous';
    parts.push(apiKey.toString());
  }
  
  // Add content type
  if (options.strategies?.byContentType) {
    const contentType = request.headers['accept'] || '*/*';
    parts.push(contentType.toString());
  }
  
  // Generate hash
  return crypto
    .createHash('md5')
    .update(parts.join('|'))
    .digest('hex');
};

// Check if request should be cached
const shouldCache = (
  request: FastifyRequest,
  options: CacheOptions
): boolean => {
  // Check if caching is enabled
  if (!options.enabled) {
    return false;
  }
  
  // Check method
  if (options.exclude?.methods?.includes(request.method)) {
    return false;
  }
  
  // Check path
  if (options.exclude?.paths) {
    for (const pattern of options.exclude.paths) {
      const regex = new RegExp(pattern);
      
      if (regex.test(request.url)) {
        return false;
      }
    }
  }
  
  return true;
};

// Check if response should be cached
const shouldCacheResponse = (
  reply: FastifyReply,
  options: CacheOptions
): boolean => {
  // Check status code
  if (options.exclude?.statusCodes?.includes(reply.statusCode)) {
    return false;
  }
  
  return true;
};

const advancedCachePlugin: FastifyPluginAsync<CacheOptions> = async (fastify, options) => {
  // Merge options with defaults
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Create cache store
  let cacheStore: MemoryCacheStore | RedisCacheStore;
  
  if (mergedOptions.storage === 'redis') {
    try {
      // Try to use Redis if available
      if (!fastify.redis) {
        throw new Error('Redis not available');
      }
      
      cacheStore = new RedisCacheStore(fastify.redis);
      fastify.log.info('Using Redis store for advanced caching');
    } catch (err) {
      // Fall back to memory store
      fastify.log.warn('Redis not available, falling back to memory store for advanced caching');
      cacheStore = new MemoryCacheStore();
    }
  } else {
    // Use memory store
    cacheStore = new MemoryCacheStore();
    fastify.log.info('Using memory store for advanced caching');
  }
  
  // Add onRequest hook to check cache
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip if request should not be cached
    if (!shouldCache(request, mergedOptions)) {
      return;
    }
    
    // Generate cache key
    const cacheKey = generateCacheKey(request, mergedOptions);
    request.cacheKey = cacheKey;
    
    // Try to get from cache
    const cachedResponse = await cacheStore.get(cacheKey);
    
    if (cachedResponse) {
      try {
        // Parse cached response
        const { statusCode, headers, payload } = JSON.parse(
          decompressData(cachedResponse)
        );
        
        // Set headers
        for (const [key, value] of Object.entries(headers)) {
          reply.header(key, value);
        }
        
        // Add cache header
        reply.header('X-Cache', 'HIT');
        
        // Send cached response
        reply.code(statusCode).send(payload);
        
        // End request
        return reply;
      } catch (err) {
        fastify.log.error({
          msg: 'Error parsing cached response',
          error: err instanceof Error ? err.message : String(err),
          cacheKey,
        });
      }
    }
    
    // Add cache header
    reply.header('X-Cache', 'MISS');
  });
  
  // Add onSend hook to cache response
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Skip if request should not be cached or no cache key
    if (!request.cacheKey || !shouldCache(request, mergedOptions) || !shouldCacheResponse(reply, mergedOptions)) {
      return payload;
    }
    
    try {
      // Prepare response to cache
      const response = {
        statusCode: reply.statusCode,
        headers: reply.getHeaders(),
        payload,
      };
      
      // Serialize and compress
      const serialized = JSON.stringify(response);
      
      // Only compress if enabled and payload is large enough
      const compressed = mergedOptions.compression?.enabled && 
                         serialized.length >= (mergedOptions.compression.minSize || 0)
        ? compressData(serialized)
        : serialized;
      
      // Cache response
      await cacheStore.set(
        request.cacheKey,
        compressed,
        mergedOptions.ttl!
      );
    } catch (err) {
      fastify.log.error({
        msg: 'Error caching response',
        error: err instanceof Error ? err.message : String(err),
        cacheKey: request.cacheKey,
      });
    }
    
    return payload;
  });
  
  // Expose cache API
  fastify.decorate('advancedCache', {
    // Clear all cache
    clear: async () => {
      await cacheStore.clear();
    },
    
    // Invalidate cache by key
    invalidate: async (key: string) => {
      await cacheStore.del(key);
    },
    
    // Invalidate cache by pattern
    invalidateByPattern: async (pattern: string) => {
      await cacheStore.delByPattern(pattern);
    },
    
    // Invalidate cache by model
    invalidateByModel: async (model: string, id?: string) => {
      const patterns = mergedOptions.invalidation?.models?.[model];
      
      if (!patterns) {
        return;
      }
      
      for (const pattern of patterns) {
        // Replace placeholders
        const resolvedPattern = id
          ? pattern.replace('{id}', id)
          : pattern;
        
        await cacheStore.delByPattern(resolvedPattern);
      }
    },
    
    // Get options
    getOptions: () => ({ ...mergedOptions }),
  });
};

// Extend FastifyRequest to include cache key
declare module 'fastify' {
  interface FastifyRequest {
    cacheKey?: string;
  }
  
  interface FastifyInstance {
    advancedCache: {
      clear: () => Promise<void>;
      invalidate: (key: string) => Promise<void>;
      invalidateByPattern: (pattern: string) => Promise<void>;
      invalidateByModel: (model: string, id?: string) => Promise<void>;
      getOptions: () => CacheOptions;
    };
  }
}

export default fp(advancedCachePlugin, {
  name: 'advanced-cache',
  fastify: '4.x',
  dependencies: ['@fastify/redis'],
});