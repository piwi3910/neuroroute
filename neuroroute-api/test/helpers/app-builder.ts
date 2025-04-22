import Fastify, { FastifyInstance } from 'fastify';
import { registerPlugins, registerRoutes } from '../../src/app.js';

/**
 * Options for building a test instance of the app
 */
export interface BuildOptions {
  /**
   * Environment variables to set
   */
  env?: Record<string, string>;
  
  /**
   * Mock Prisma client
   */
  prisma?: Record<string, unknown>;
}

/**
 * Build a test instance of the Fastify app with mocked dependencies
 * 
 * @param options Test configuration options
 * @returns Configured Fastify instance
 */
export async function build(options: BuildOptions = {}): Promise<FastifyInstance> {
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