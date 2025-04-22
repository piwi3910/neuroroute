import { FastifyPluginAsync } from 'fastify';
import fastifyRedis from '@fastify/redis';

// Redis configuration plugin
const redisPlugin: FastifyPluginAsync = async (fastify) => {
  // Get Redis URL from environment variables or use default
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  await fastify.register(fastifyRedis, {
    url: redisUrl,
    closeClient: true,
  });

  fastify.log.info({ redisUrl }, 'Redis plugin registered');
};

export default redisPlugin;