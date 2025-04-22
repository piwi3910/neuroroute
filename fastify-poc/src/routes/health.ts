import { FastifyPluginAsync } from 'fastify';
import { version } from '../../package.json';

/**
 * Health check endpoint
 *
 * This endpoint provides health status information about the application
 * and its dependencies.
 */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            environment: { type: 'string' },
            uptime: { type: 'number' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['ok', 'error', 'unknown'] },
                redis: { type: 'string', enum: ['ok', 'error', 'unknown', 'disabled'] },
              },
            },
            config: {
              type: 'object',
              properties: {
                cache_enabled: { type: 'boolean' },
                swagger_enabled: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { config } = fastify;
      const startTime = process.hrtime();
      
      // Check database connection
      let databaseStatus = 'unknown';
      try {
        const isDatabaseHealthy = await fastify.isDatabaseHealthy();
        databaseStatus = isDatabaseHealthy ? 'ok' : 'error';
      } catch (error) {
        request.log.error(error, 'Database health check failed');
        databaseStatus = 'error';
      }

      // Check Redis connection if enabled
      let redisStatus = 'disabled';
      if (config.ENABLE_CACHE) {
        try {
          const isRedisHealthy = await fastify.isRedisHealthy();
          redisStatus = isRedisHealthy ? 'ok' : 'error';
        } catch (error) {
          request.log.error(error, 'Redis health check failed');
          redisStatus = 'error';
        }
      }
      
      // Determine overall status
      let overallStatus = 'ok';
      if (databaseStatus === 'error') {
        overallStatus = 'error';
      } else if (config.ENABLE_CACHE && redisStatus === 'error') {
        overallStatus = 'degraded';
      }
      
      // Calculate response time
      const hrtime = process.hrtime(startTime);
      const responseTimeMs = hrtime[0] * 1000 + hrtime[1] / 1000000;
      
      // Log health check result
      request.log.info({
        status: overallStatus,
        database: databaseStatus,
        redis: redisStatus,
        responseTime: `${responseTimeMs.toFixed(2)}ms`
      }, 'Health check completed');

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version,
        environment: config.NODE_ENV,
        uptime: process.uptime(),
        services: {
          database: databaseStatus,
          redis: redisStatus,
        },
        config: {
          cache_enabled: config.ENABLE_CACHE,
          swagger_enabled: config.ENABLE_SWAGGER,
        },
      };
    },
  });
};

export default healthRoutes;