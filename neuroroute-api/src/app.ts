console.log(`process.env.PORT at start: ${process.env.PORT}`);
import Fastify, { FastifyInstance } from 'fastify';
import { AppConfig } from './config.js';

// Import plugins
import envPlugin from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import redisPlugin from './plugins/redis.js';
import swaggerPlugin from './plugins/swagger.js';
import authPlugin from './plugins/auth.js';
import monitoringPlugin from './plugins/monitoring.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import dbOptimizerPlugin from './plugins/db-optimizer.js';
import advancedCachePlugin from './plugins/advanced-cache.js';
import configManagerPlugin from './plugins/config-manager.js';
import { prismaPlugin } from './services/prisma.js';
import flowArchitecturePlugin from './plugins/flow-architecture.js';

// Import utilities
import logger from './utils/logger.js';

// Import routes
import healthRoutes from './routes/health.js';
import modelsRoutes from './routes/models.js';
import promptRoutes from './routes/prompt.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import chatRoutes from './routes/chat.js';

// Declare module augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

/**
 * Create and configure the Fastify server
 *
 * @returns The configured Fastify instance
 */
export function createServer(): FastifyInstance {
  // Create Fastify instance
  const server: FastifyInstance = Fastify({
    logger: {
      level: 'info',
      redact: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.body.password',
        'req.body.apiKey',
      ],
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
    // Add request ID to each request
    genReqId: (req) => {
      const requestId = req.headers['x-request-id'] as string;
      return requestId || `req-${Math.random().toString(36).substring(2, 15)}`;
    },
  });

  return server;
}

/**
 * Register all plugins
 *
 * @param server The Fastify instance
 */
export async function registerPlugins(server: FastifyInstance): Promise<void> {
  // Register environment configuration plugin first
  await server.register(envPlugin);
  
  // Register database plugin
  await server.register(prismaPlugin);
  
  // Register config manager plugin
  await server.register(configManagerPlugin);
  
  // Register flow architecture plugin
  await server.register(flowArchitecturePlugin);
  
  // Register database optimizer
  // Get configuration with fallbacks for database optimizer
  const dbConfig = (server as any).config ?? {};
  
  await server.register(dbOptimizerPlugin, {
    logQueries: dbConfig.NODE_ENV === 'development',
    logSlowQueries: true,
    slowQueryThreshold: dbConfig.DB_SLOW_QUERY_THRESHOLD ?? 500,
    collectMetrics: true,
    pool: {
      min: dbConfig.DB_POOL_MIN ?? 2,
      max: dbConfig.DB_POOL_MAX ?? 10,
    }
  });
  
  // Register other plugins
  await server.register(corsPlugin);
  await server.register(authPlugin);
  
  // Only register Redis if enabled (with fallback)
  const config = (server as any).config ?? {};
  if (config.ENABLE_CACHE !== false) {
    await server.register(redisPlugin);
    
    // Register advanced cache plugin
    const cacheConfig = (server as any).config ?? {};
    await server.register(advancedCachePlugin, {
      enabled: cacheConfig.ENABLE_CACHE !== false,
      ttl: cacheConfig.CACHE_TTL ?? 300,
      prefix: cacheConfig.CACHE_PREFIX ?? 'cache:',
      storage: 'redis',
      strategies: {
        byPath: true,
        byQueryParams: true,
        byHeaders: ['accept-language'],
        byUser: cacheConfig.CACHE_BY_USER === 'true',
        byContentType: true,
      },
      exclude: {
        paths: ['^/health', '^/metrics', '^/admin'],
        methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
      },
      invalidation: {
        models: {
          'model': ['cache:models:*'],
          'user': ['cache:users:*', 'cache:admin:users:*'],
          'config': ['cache:*'], // Invalidate all cache when config changes
        }
      }
    });
  }
  
  // Only register Swagger if enabled (with fallback)
  if (config.ENABLE_SWAGGER !== false) {
    await server.register(swaggerPlugin);
  }
  
  // Get configuration with fallbacks for monitoring
  const monConfig = (server as any).config ?? {};
  
  // Register monitoring plugin
  await server.register(monitoringPlugin, {
    enableMetrics: monConfig.ENABLE_METRICS !== false,
    metricsPath: monConfig.METRICS_PATH ?? '/metrics',
    collectDefaultMetrics: true,
    enableTracing: monConfig.NODE_ENV === 'production',
    sampleRate: monConfig.METRICS_SAMPLE_RATE ?? 1.0,
    exporters: {
      prometheus: true,
      console: monConfig.NODE_ENV === 'development',
    }
  });
  
  // Get configuration with fallbacks for rate limiting
  const rateConfig = (server as any).config ?? {};
  
  // Register rate limiting plugin
  await server.register(rateLimitPlugin, {
    global: {
      max: rateConfig.RATE_LIMIT_MAX ?? 100,
      timeWindow: rateConfig.RATE_LIMIT_WINDOW ?? 60000, // 1 minute
    },
    endpoints: {
      '/prompt': {
        max: rateConfig.PROMPT_RATE_LIMIT_MAX ?? 20,
        timeWindow: rateConfig.PROMPT_RATE_LIMIT_WINDOW ?? 60000,
      },
      '/admin/.*': {
        max: rateConfig.ADMIN_RATE_LIMIT_MAX ?? 50,
        timeWindow: rateConfig.ADMIN_RATE_LIMIT_WINDOW ?? 60000,
      }
    },
    store: rateConfig.REDIS_URL ? 'redis' : 'memory',
  });
  
  // Setup enhanced request logging with correlation IDs and metrics
  logger.setupRequestLogging(server);
}

/**
 * Register all routes
 *
 * @param server The Fastify instance
 */
export async function registerRoutes(server: FastifyInstance): Promise<void> {
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(modelsRoutes, { prefix: '/models' });
  await server.register(promptRoutes, { prefix: '/prompt' });
  await server.register(adminRoutes, { prefix: '/admin' });
  await server.register(dashboardRoutes, { prefix: '/dashboard' });
  await server.register(chatRoutes, { prefix: '/chat' });
}

/**
 * Start the server
 */
async function start() {
  try {
    // Create server
    const server = createServer();
    
    // Register plugins and routes
    await registerPlugins(server);
    await registerRoutes(server);

    // Get configuration with fallbacks
    const config = (server as any).config ?? {};
    const PORT = config.PORT ?? 3000;
    const HOST = config.HOST ?? '0.0.0.0';
    const NODE_ENV = config.NODE_ENV ?? 'development';

    server.log.info(`Configured PORT: ${config.PORT}`);
    server.log.info(`Derived PORT: ${PORT}`);
    server.log.info(`Derived HOST: ${HOST}`);
    // Start listening
    await server.listen({ port: PORT, host: HOST });
    
    server.log.info(`Server is running on ${HOST}:${PORT} in ${NODE_ENV} mode`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await server.close();
  process.exit(0);
});

// Create server instance
const server = createServer();

// Start the server if this file is run directly
// Using import.meta.url to check if this is the main module
const isMainModule = import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ''));
if (isMainModule) {
  start();
}

export default server;