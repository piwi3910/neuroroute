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

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    
    console.log(`Server is running on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

// Start the server
start();

export default server;