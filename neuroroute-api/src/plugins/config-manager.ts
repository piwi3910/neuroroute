import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createConfigManager } from '../services/config-manager.js';

/**
 * ConfigManager plugin for Fastify
 * 
 * This plugin registers the ConfigManager service with Fastify,
 * making it available to all routes and other plugins.
 */
const configManagerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Create config manager
  const configManager = createConfigManager(fastify);
  
  // Decorate fastify instance with config manager
  fastify.decorate('configManager', configManager);
  
  // Log initialization
  fastify.log.info('ConfigManager initialized');
  
  // Add hook to close config manager on server close
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing ConfigManager');
  });
};

// Declare module augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    configManager: ReturnType<typeof createConfigManager>;
  }
}

export default fp(configManagerPlugin, {
  name: 'config-manager',
  dependencies: ['env', 'prisma']
});