import { FastifyPluginAsync } from 'fastify';
import fastifyRedis from '@fastify/redis';

// Redis configuration plugin
const redisPlugin: FastifyPluginAsync = async (fastify) => {
  // Get Redis URL from environment variables or use default
  // Use type assertion to access config property
  const config = (fastify as any).config;
  const redisUrl = config?.REDIS_URL || 'redis://localhost:6379';

  await fastify.register(fastifyRedis, {
    url: redisUrl,
    closeClient: true,
  });

  fastify.log.info({ redisUrl }, 'Redis plugin registered');
};

export default redisPlugin;