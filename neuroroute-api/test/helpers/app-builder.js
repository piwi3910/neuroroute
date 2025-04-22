import Fastify from 'fastify';
import { registerPlugins, registerRoutes } from '../../src/app.js';

/**
 * Build a test instance of the Fastify app with mocked dependencies
 * 
 * @param {Object} options Test configuration options
 * @param {Object} options.env Environment variables to set
 * @param {Object} options.prisma Mock Prisma client
 * @returns {Promise<import('fastify').FastifyInstance>} Configured Fastify instance
 */
export async function build(options = {}) {
  // Create Fastify instance
  const app = Fastify({
    logger: false
  });

  // Set environment variables
  if (options.env) {
    app.decorate('config', options.env);
  }

  // Mock Prisma client
  if (options.prisma) {
    app.decorate('prisma', options.prisma);
  }

  // Register plugins with test configuration
  await registerPlugins(app);
  
  // Register routes
  await registerRoutes(app);

  return app;
}