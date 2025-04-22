import Fastify, { FastifyInstance } from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';

// Import plugins
import envPlugin from './plugins/env';
import corsPlugin from './plugins/cors';
import redisPlugin from './plugins/redis';
import swaggerPlugin from './plugins/swagger';

// Import routes
import healthRoutes from './routes/health';
import modelsRoutes from './routes/models';
import promptRoutes from './routes/prompt';

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
});

// Register plugins
async function registerPlugins() {
  await server.register(envPlugin);
  await server.register(corsPlugin);
  await server.register(redisPlugin);
  await server.register(swaggerPlugin);
}

// Register routes
async function registerRoutes() {
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(modelsRoutes, { prefix: '/models' });
  await server.register(promptRoutes, { prefix: '/prompt' });
}

// Start server
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    // Access config from server instance after plugins are registered
    const config = (server as any).config || {};
    const port = config.PORT ? parseInt(String(config.PORT), 10) : 3000;
    const host = config.HOST || '0.0.0.0';

    await server.listen({ port, host });
    
    server.log.info(`Server is running on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    // Use Node.js process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).process?.exit?.(1);
  }
}

// Handle graceful shutdown
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).process?.on?.('SIGINT', async () => {
  await server.close();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).process?.exit?.(0);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).process?.on?.('SIGTERM', async () => {
  await server.close();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).process?.exit?.(0);
});

// Start the server
start();

export default server;