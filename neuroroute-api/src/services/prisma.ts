import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client instance
 */
export const prisma = new PrismaClient();

/**
 * Prisma plugin for Fastify
 * 
 * This plugin adds the Prisma client to the Fastify instance.
 */
export const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Add Prisma client to Fastify instance
  fastify.decorate('prisma', prisma);
  
  // Add health check method
  fastify.decorate('isDatabaseHealthy', async () => {
    try {
      // Execute a simple query to check database connection
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      fastify.log.error(error, 'Database health check failed');
      return false;
    }
  });
  
  // Close Prisma client on server close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
    fastify.log.info('Prisma client disconnected');
  });
  
  fastify.log.info('Prisma plugin registered');
};

// Add type declaration for the prisma property and isDatabaseHealthy method
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    isDatabaseHealthy: () => Promise<boolean>;
  }
}

export default prismaPlugin;