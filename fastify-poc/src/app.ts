import Fastify, { FastifyInstance } from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';
import { AppConfig } from './config';

// Import plugins
import envPlugin from './plugins/env';
import corsPlugin from './plugins/cors';
import redisPlugin from './plugins/redis';
import swaggerPlugin from './plugins/swagger';
import authPlugin from './plugins/auth';
import { prismaPlugin } from './services/prisma';

// Import routes
import healthRoutes from './routes/health';
import modelsRoutes from './routes/models';
import promptRoutes from './routes/prompt';

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
  
  // Register other plugins
  await server.register(corsPlugin);
  await server.register(authPlugin);
  
  // Only register Redis if enabled (with fallback)
  const config = (server as any).config || {};
  if (config.ENABLE_CACHE !== false) {
    await server.register(redisPlugin);
  }
  
  // Only register Swagger if enabled (with fallback)
  if (config.ENABLE_SWAGGER !== false) {
    await server.register(swaggerPlugin);
  }
  
  // Add global hooks
  server.addHook('onRequest', (request, reply, done) => {
    request.log.info({
      url: request.url,
      method: request.method,
      id: request.id
    }, 'incoming request');
    done();
  });
  
  // Add error handler
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    
    // Determine status code
    const statusCode = error.statusCode || 500;
    
    // Send error response
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
      requestId: request.id
    });
  });
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
    const config = (server as any).config || {};
    const PORT = config.PORT || 3000;
    const HOST = config.HOST || '0.0.0.0';
    const NODE_ENV = config.NODE_ENV || 'development';

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
if (require.main === module) {
  start();
}

export default server;