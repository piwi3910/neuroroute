/**
 * Flow Architecture Plugin
 * 
 * This plugin registers all the components of the flow architecture:
 * - Preprocessor Service
 * - Classifier Service
 * - Router Service (Routing Engine and Normalization Engine)
 * 
 * These services are registered as decorators on the Fastify instance.
 */

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createPreprocessorService } from '../services/preprocessor/index.js';
import { createClassifierService } from '../services/classifier/index.js';
import { createRoutingEngine } from '../services/router/routing/index.js';
import { createNormalizationEngine } from '../services/router/normalization/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Flow Architecture Plugin
 * 
 * @param fastify - The Fastify instance
 */
const flowArchitecturePlugin: FastifyPluginAsync = async (fastify) => {
  logger.info('Initializing Flow Architecture components');

  try {
    // Create the preprocessor service
    const preprocessorService = createPreprocessorService();
    logger.debug('Preprocessor service created');

    // Create the classifier service
    const classifierService = createClassifierService(fastify);
    logger.debug('Classifier service created');

    // Create the routing engine
    const routingEngine = createRoutingEngine();
    logger.debug('Routing engine created');

    // Create the normalization engine
    const normalizationEngine = createNormalizationEngine();
    logger.debug('Normalization engine created');

    // Decorate the Fastify instance with the services
    fastify.decorate('preprocessor', preprocessorService);
    fastify.decorate('classifier', classifierService);
    fastify.decorate('router', {
      routing: routingEngine,
      normalization: normalizationEngine
    });

    logger.info('Flow Architecture components registered successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Flow Architecture components');
    throw error;
  }
};

export default fp(flowArchitecturePlugin, {
  name: 'flow-architecture',
  dependencies: ['env', 'prisma'] // Add dependencies if needed
});