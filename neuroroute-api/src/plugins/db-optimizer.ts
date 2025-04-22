import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

interface DbOptimizerOptions {
  // Connection pool settings
  pool?: {
    min?: number;
    max?: number;
    idle?: number; // milliseconds
  };
  
  // Query logging
  logQueries?: boolean;
  logSlowQueries?: boolean;
  slowQueryThreshold?: number; // milliseconds
  
  // Query metrics
  collectMetrics?: boolean;
  
  // Connection health check
  healthCheck?: boolean;
  healthCheckInterval?: number; // milliseconds
}

// Default options
const defaultOptions: DbOptimizerOptions = {
  pool: {
    min: 2,
    max: 10,
    idle: 10000, // 10 seconds
  },
  logQueries: false,
  logSlowQueries: true,
  slowQueryThreshold: 500, // 500 milliseconds
  collectMetrics: true,
  healthCheck: true,
  healthCheckInterval: 30000, // 30 seconds
};

// Query metrics
interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  totalQueryTime: number;
  averageQueryTime: number;
  queryCountByModel: Record<string, number>;
  queryTimeByModel: Record<string, number>;
  slowQueriesByModel: Record<string, number>;
}

// Initialize metrics
const metrics: QueryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  totalQueryTime: 0,
  averageQueryTime: 0,
  queryCountByModel: {},
  queryTimeByModel: {},
  slowQueriesByModel: {},
};

// Middleware to track query performance
const createQueryMiddleware = (options: DbOptimizerOptions, log: any) => {
  return async (params: any, next: (params: any) => Promise<any>) => {
    // Extract query information
    const { model, action, args } = params;
    const startTime = Date.now();
    
    try {
      // Execute the query
      const result = await next(params);
      
      // Calculate query time
      const queryTime = Date.now() - startTime;
      
      // Update metrics if enabled
      if (options.collectMetrics) {
        metrics.totalQueries++;
        metrics.totalQueryTime += queryTime;
        metrics.averageQueryTime = metrics.totalQueryTime / metrics.totalQueries;
        
        // Track by model
        const modelKey = `${model}.${action}`;
        metrics.queryCountByModel[modelKey] = (metrics.queryCountByModel[modelKey] || 0) + 1;
        metrics.queryTimeByModel[modelKey] = (metrics.queryTimeByModel[modelKey] || 0) + queryTime;
        
        // Check for slow queries
        if (options.logSlowQueries && queryTime > (options.slowQueryThreshold || 500)) {
          metrics.slowQueries++;
          metrics.slowQueriesByModel[modelKey] = (metrics.slowQueriesByModel[modelKey] || 0) + 1;
          
          // Log slow query
          log.warn({
            msg: 'Slow database query detected',
            model,
            action,
            queryTime: `${queryTime}ms`,
            threshold: `${options.slowQueryThreshold}ms`,
            args: JSON.stringify(args),
          });
        }
      }
      
      // Log all queries if enabled
      if (options.logQueries) {
        log.debug({
          msg: 'Database query',
          model,
          action,
          queryTime: `${queryTime}ms`,
          args: JSON.stringify(args),
        });
      }
      
      return result;
    } catch (error) {
      // Log query errors
      log.error({
        msg: 'Database query error',
        model,
        action,
        error: error instanceof Error ? error.message : String(error),
        args: JSON.stringify(args),
      });
      
      throw error;
    }
  };
};

// Health check function
const createHealthCheck = (prisma: PrismaClient, log: any) => {
  return async () => {
    try {
      // Simple query to check database connection
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      log.error({
        msg: 'Database health check failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };
};

const dbOptimizerPlugin: FastifyPluginAsync<DbOptimizerOptions> = async (fastify, options) => {
  // Merge options with defaults
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Get Prisma client from fastify instance
  const prisma = fastify.prisma as PrismaClient;
  
  if (!prisma) {
    throw new Error('Prisma client not found. Make sure to register the prisma plugin first.');
  }
  
  // Add query middleware
  const queryMiddleware = createQueryMiddleware(mergedOptions, fastify.log);
  prisma.$use(queryMiddleware);
  
  // Set up health check
  if (mergedOptions.healthCheck) {
    const healthCheck = createHealthCheck(prisma, fastify.log);
    
    // Run health check periodically
    const healthCheckInterval = setInterval(async () => {
      const isHealthy = await healthCheck();
      
      if (!isHealthy) {
        fastify.log.error('Database connection is unhealthy');
        
        // Attempt to reconnect
        try {
          await prisma.$disconnect();
          await prisma.$connect();
          fastify.log.info('Database reconnection successful');
        } catch (error) {
          fastify.log.error({
            msg: 'Database reconnection failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, mergedOptions.healthCheckInterval);
    
    // Clean up on close
    fastify.addHook('onClose', async () => {
      clearInterval(healthCheckInterval);
    });
  }
  
  // Expose metrics and utilities
  fastify.decorate('dbMetrics', {
    getMetrics: () => ({ ...metrics }),
    resetMetrics: () => {
      metrics.totalQueries = 0;
      metrics.slowQueries = 0;
      metrics.totalQueryTime = 0;
      metrics.averageQueryTime = 0;
      metrics.queryCountByModel = {};
      metrics.queryTimeByModel = {};
      metrics.slowQueriesByModel = {};
    },
    runHealthCheck: createHealthCheck(prisma, fastify.log),
  });
  
  // Add health check to the health endpoint
  fastify.addHook('onReady', async () => {
    if (fastify.hasRoute({ method: 'GET', url: '/health' })) {
      const healthCheck = createHealthCheck(prisma, fastify.log);
      
      // Extend existing health check
      fastify.addHook('preHandler', async (request, reply) => {
        if (request.url === '/health') {
          request.dbHealthy = await healthCheck();
        }
      });
    }
  });
};

// Extend FastifyRequest to include database health
declare module 'fastify' {
  interface FastifyRequest {
    dbHealthy?: boolean;
  }
  
  interface FastifyInstance {
    dbMetrics: {
      getMetrics: () => QueryMetrics;
      resetMetrics: () => void;
      runHealthCheck: () => Promise<boolean>;
    };
  }
}

export default fp(dbOptimizerPlugin, {
  name: 'db-optimizer',
  fastify: '4.x',
  dependencies: ['prisma'],
});