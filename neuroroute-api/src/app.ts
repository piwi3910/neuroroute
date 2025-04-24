console.log(`process.env.PORT at start: ${process.env.PORT}`);
// Import necessary types from fastify and the zod provider
// Remove unused RawRequestDefaultExpression
import Fastify, { FastifyInstance, FastifyBaseLogger, RawServerDefault } from 'fastify';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { AppConfig, LogLevel } from './config.js'; // Import LogLevel
import http from 'http'; // Import http for IncomingMessage type

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
import logger from './utils/logger.js'; // Assuming this is a custom logger setup function

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

// Define the type for the server instance with Zod provider
type AppServer = FastifyInstance<
  RawServerDefault, // Default Node.js HTTP server
  http.IncomingMessage, // Default IncomingMessage
  http.ServerResponse, // Default ServerResponse
  FastifyBaseLogger,
  ZodTypeProvider // Specify Zod as the type provider
>;

// Declare server instance variable in a scope accessible by start and shutdown handlers
// Initialize as null
let serverInstance: AppServer | null = null;

/**
 * Create and configure the Fastify server
 *
 * @returns The configured Fastify instance
 */
export function createServer(): AppServer {
  // Create Fastify instance with logger options first
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL as LogLevel || 'info', // Use LOG_LEVEL from env or default
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
    // Add request ID generator - use IncomingMessage type
    genReqId: (req: http.IncomingMessage) => {
      const requestId = req.headers['x-request-id'] as string;
      return requestId || `req-${Math.random().toString(36).substring(2, 15)}`;
    },
  }).withTypeProvider<ZodTypeProvider>(); // Chain withTypeProvider

  // Set Zod as the validator and serializer
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  return server;
}

/**
 * Register all plugins
 *
 * @param server The Fastify instance
 */
export async function registerPlugins(server: AppServer): Promise<void> { // Use AppServer type
  // Register environment configuration plugin first
  await server.register(envPlugin);

  // Register database plugin
  await server.register(prismaPlugin);

  // Register config manager plugin
  await server.register(configManagerPlugin);

  // Register flow architecture plugin
  await server.register(flowArchitecturePlugin);

  // Register database optimizer
  const dbConfig = server.config ?? {}; // Access config safely

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

  // Only register Redis if enabled
  const config = server.config ?? {};
  if (config.ENABLE_CACHE !== false) {
    await server.register(redisPlugin);

    // Register advanced cache plugin
    const cacheConfig = server.config ?? {};
    await server.register(advancedCachePlugin, {
      enabled: cacheConfig.ENABLE_CACHE !== false,
      ttl: cacheConfig.REDIS_CACHE_TTL ?? 300, // Use REDIS_CACHE_TTL
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

  // Only register Swagger if enabled
  if (config.ENABLE_SWAGGER !== false) {
    await server.register(swaggerPlugin);
  }

  // Get configuration with fallbacks for monitoring
  const monConfig = server.config ?? {};

  // Register monitoring plugin
  await server.register(monitoringPlugin, {
    enableMetrics: monConfig.ENABLE_METRICS !== false,
    metricsPath: monConfig.METRICS_PATH ?? '/metrics',
    collectDefaultMetrics: true,
    enableTracing: monConfig.ENABLE_TRACING !== false, // Corrected check
    sampleRate: monConfig.METRICS_SAMPLE_RATE ?? 1.0,
    exporters: {
      prometheus: true,
      console: monConfig.NODE_ENV === 'development',
    }
  });

  // Get configuration with fallbacks for rate limiting
  const rateConfig = server.config ?? {};

  // Register rate limiting plugin
  await server.register(rateLimitPlugin, {
    global: {
      max: rateConfig.API_RATE_LIMIT ?? 100, // Use API_RATE_LIMIT
      timeWindow: 60000, // Default 1 minute, maybe add RATE_LIMIT_WINDOW to config?
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

  // Setup enhanced request logging (assuming logger utility handles this)
  logger.setupRequestLogging(server);
}

/**
 * Register all routes
 *
 * @param server The Fastify instance
 */
export async function registerRoutes(server: AppServer): Promise<void> { // Use AppServer type
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
    // Create server instance and assign to the higher-scoped variable
    serverInstance = createServer();

    // Register plugins and routes
    await registerPlugins(serverInstance);
    await registerRoutes(serverInstance);

    // Get configuration with fallbacks
    const config = serverInstance.config ?? {};
    const PORT = config.PORT ?? 3000;
    const HOST = config.HOST ?? '0.0.0.0';
    const NODE_ENV = config.NODE_ENV ?? 'development';

    serverInstance.log.info(`Configured PORT: ${config.PORT}`);
    serverInstance.log.info(`Derived PORT: ${PORT}`);
    serverInstance.log.info(`Derived HOST: ${HOST}`);
    // Start listening
    await serverInstance.listen({ port: PORT, host: HOST });

    serverInstance.log.info(`Server is running on ${HOST}:${PORT} in ${NODE_ENV} mode`);
  } catch (err) {
    // Use logger if available, otherwise console.error
    const log = serverInstance ? serverInstance.log : console;
    log.error({ err }, 'Error starting server'); // Log the error object
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down server...');
  if (serverInstance) {
    await serverInstance.close();
    console.log('Server closed.');
  } else {
    console.log('Server instance not found during SIGINT.');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down server...');
   if (serverInstance) {
    await serverInstance.close();
    console.log('Server closed.');
  } else {
    console.log('Server instance not found during SIGTERM.');
  }
  process.exit(0);
});


// Start the server if this file is run directly
// Using import.meta.url check for ESM compatibility
try {
    const currentFileUrl = import.meta.url;
    // Use fileURLToPath for robust path conversion
    const currentFilePath = new URL(currentFileUrl).pathname;
    // process.argv[1] might need adjustment depending on execution context (e.g., ts-node)
    const entryFilePath = process.argv[1];

    // A more robust check might involve resolving paths fully
    // Also include require.main check for potential CJS execution contexts
    if (currentFilePath.endsWith(entryFilePath) || (typeof require !== 'undefined' && require.main === module)) {
      start();
    }
} catch (e) {
    console.warn("Could not determine if running as main module, starting server anyway.", e);
    start(); // Fallback to starting if check fails
}


// Export necessary functions for potential programmatic use or testing
// Removed createServer, registerPlugins, registerRoutes as they are already exported above
export { start };