import { FastifyPluginAsync } from 'fastify';
import fastifyRedis from '@fastify/redis';
import fp from 'fastify-plugin';

/**
 * Redis configuration plugin
 *
 * This plugin configures the Redis connection for caching.
 */
const redisPlugin: FastifyPluginAsync = async (fastify) => {
  // Get Redis configuration from fastify.config with fallbacks
  const config = (fastify as any).config ?? {};
  const REDIS_URL = config.REDIS_URL ?? 'redis://localhost:6379';
  const REDIS_CACHE_TTL = config.REDIS_CACHE_TTL ?? 300;

  try {
    // Register Redis plugin
    await fastify.register(fastifyRedis, {
      url: REDIS_URL,
      closeClient: true,
      // Add additional Redis options
      connectTimeout: 5000, // 5 seconds
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    // Test Redis connection
    const pingResult = await fastify.redis.ping();
    
    fastify.log.info({
      redisUrl: REDIS_URL,
      cacheTTL: REDIS_CACHE_TTL,
      ping: pingResult
    }, 'Redis plugin registered successfully');
    
    // Add Redis health check
    fastify.decorate('isRedisHealthy', async () => {
      try {
        const pingResult = await fastify.redis.ping();
        return pingResult === 'PONG';
      } catch (error) {
        fastify.log.error(error, 'Redis health check failed');
        return false;
      }
    });
    
  } catch (error) {
    // Log error but don't fail startup
    fastify.log.error(error, 'Redis connection failed');
    
    // Decorate with a non-functional isRedisHealthy method
    fastify.decorate('isRedisHealthy', async () => false);
  }
};

// Add type declaration for the isRedisHealthy method
declare module 'fastify' {
  interface FastifyInstance {
    isRedisHealthy: () => Promise<boolean>;
  }
}

export default fp(redisPlugin, {
  name: 'redis'
});