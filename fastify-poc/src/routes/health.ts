import { FastifyPluginAsync } from 'fastify';

// Health check endpoint
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      // Check database connection
      let databaseStatus = 'unknown';
      try {
        // In a real implementation, we would check the database connection
        databaseStatus = 'ok';
      } catch (error) {
        fastify.log.error(error);
        databaseStatus = 'error';
      }

      // Check Redis connection
      let redisStatus = 'unknown';
      try {
        await fastify.redis.ping();
        redisStatus = 'ok';
      } catch (error) {
        fastify.log.error(error);
        redisStatus = 'error';
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: databaseStatus,
          redis: redisStatus,
        },
      };
    },
  });
};

export default healthRoutes;