import Fastify, { FastifyInstance } from 'fastify';
import { registerPlugins, registerRoutes } from '../../src/app.js';
import { AppConfig } from '../../src/config.js';
import { PrismaClient } from '@prisma/client';

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
    app.decorate('config', options.env as unknown as AppConfig);
  }

  // Mock Prisma client
  if (options.prisma) {
    app.decorate('prisma', options.prisma as unknown as PrismaClient);
  }

  // Register plugins with test configuration
  await registerPlugins(app);
  
  // Register routes
  await registerRoutes(app);

  return app;
}