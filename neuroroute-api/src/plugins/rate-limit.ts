import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

interface RateLimitOptions {
  // Global rate limit settings
  global?: {
    max: number;        // Maximum number of requests
    timeWindow: number; // Time window in milliseconds
  };
  
  // Endpoint-specific rate limits
  endpoints?: Record<string, {
      max: number;
      timeWindow: number;
    }>;
  
  // Rate limit by different keys
  keyGenerator?: (request: FastifyRequest) => string;
  
  // Skip rate limiting for certain requests
  skip?: (request: FastifyRequest) => boolean;
  
  // Response when rate limit is exceeded
  errorResponseBuilder?: (request: FastifyRequest, reply: FastifyReply, next: () => void) => void;
  
  // Store type (default: redis)
  store?: 'redis' | 'memory';
  
  // Redis prefix for rate limit keys
  redisPrefix?: string;
  
  // Headers to include in response
  addHeaders?: boolean;
}

// Default options
const defaultOptions: RateLimitOptions = {
  global: {
    max: 100,
    timeWindow: 60000, // 1 minute
  },
  keyGenerator: (request) => {
    // Default: use IP address or API key
    return request.headers['x-api-key'] as string || 
           request.headers['x-forwarded-for'] as string || 
           request.ip;
  },
  skip: (request) => {
    // Skip health check and metrics endpoints by default
    return request.url.startsWith('/health') || 
           request.url.startsWith('/metrics');
  },
  errorResponseBuilder: (request, reply, next) => {
    reply.status(429).send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, please try again later',
    });
  },
  store: 'redis',
  redisPrefix: 'ratelimit:',
  addHeaders: true,
};

// Memory store for rate limiting (used as fallback)
class MemoryStore {
  private store: Map<string, { count: number, resetTime: number }>;
  
  constructor() {
    this.store = new Map();
  }
  
  async increment(key: string, timeWindow: number): Promise<{ current: number, ttl: number }> {
    const now = Date.now();
    const record = this.store.get(key);
    
    if (!record || now > record.resetTime) {
      // Create new record
      this.store.set(key, {
        count: 1,
        resetTime: now + timeWindow,
      });
      return { current: 1, ttl: timeWindow };
    } else {
      // Increment existing record
      record.count += 1;
      const ttl = record.resetTime - now;
      return { current: record.count, ttl };
    }
  }
}

// Redis store for rate limiting
class RedisStore {
  private redis: Redis;
  private prefix: string;
  
  constructor(redis: Redis, prefix: string) {
    this.redis = redis;
    this.prefix = prefix;
  }
  
  async increment(key: string, timeWindow: number): Promise<{ current: number, ttl: number }> {
    const redisKey = `${this.prefix}${key}`;
    
    // Use Redis to increment and set expiration
    const current = await this.redis.incr(redisKey);
    
    // Set expiration if this is the first request
    if (current === 1) {
      await this.redis.pexpire(redisKey, timeWindow);
    }
    
    // Get TTL
    const ttl = await this.redis.pttl(redisKey);
    
    return { current, ttl: ttl > 0 ? ttl : 0 };
  }
}

const rateLimitPlugin: FastifyPluginAsync<RateLimitOptions> = async (fastify, options) => {
  // Merge options with defaults
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Create store based on configuration
  let store: MemoryStore | RedisStore;
  
  if (mergedOptions.store === 'redis') {
    try {
      // Try to use Redis if available
      if (!fastify.redis) {
        throw new Error('Redis not available');
      }
      store = new RedisStore(fastify.redis, mergedOptions.redisPrefix!);
      fastify.log.info('Using Redis store for rate limiting');
    } catch (err) {
      // Fall back to memory store
      fastify.log.warn('Redis not available, falling back to memory store for rate limiting');
      store = new MemoryStore();
    }
  } else {
    // Use memory store
    store = new MemoryStore();
    fastify.log.info('Using memory store for rate limiting');
  }
  
  // Add preHandler hook for rate limiting
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting if configured to do so
    if (mergedOptions.skip?.(request)) {
      return;
    }
    
    // Get rate limit settings for this endpoint
    let limit = mergedOptions.global!;
    
    // Check for endpoint-specific limits
    if (mergedOptions.endpoints) {
      // Find matching endpoint pattern
      const matchingEndpoint = Object.keys(mergedOptions.endpoints).find(pattern => {
        // Convert pattern to regex
        const regex = new RegExp(pattern);
        return regex.test(request.url);
      });
      
      if (matchingEndpoint) {
        limit = mergedOptions.endpoints[matchingEndpoint];
      }
    }
    
    // Generate key for this request
    const key = mergedOptions.keyGenerator!(request);
    
    // Increment counter
    const { current, ttl } = await store.increment(key, limit.timeWindow);
    
    // Add headers if configured
    if (mergedOptions.addHeaders) {
      reply.header('X-RateLimit-Limit', limit.max);
      reply.header('X-RateLimit-Remaining', Math.max(0, limit.max - current));
      reply.header('X-RateLimit-Reset', Math.floor(Date.now() + ttl));
    }
    
    // Check if rate limit exceeded
    if (current > limit.max) {
      // Log rate limit exceeded
      fastify.log.warn({
        msg: 'Rate limit exceeded',
        key,
        current,
        limit: limit.max,
        url: request.url,
        method: request.method,
      });
      
      // Call error response builder
      mergedOptions.errorResponseBuilder!(request, reply, () => {});
    }
  });
  
  // Expose rate limit API
  fastify.decorate('rateLimit', {
    getOptions: () => mergedOptions,
  });
};

// Extend FastifyInstance to include rate limit API
declare module 'fastify' {
  interface FastifyInstance {
    rateLimit: {
      getOptions: () => RateLimitOptions;
    };
  }
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  fastify: '5.x',
  dependencies: ['redis'],
});