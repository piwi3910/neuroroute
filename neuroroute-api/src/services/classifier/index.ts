/**
 * Classifier Service
 * 
 * This file contains the main classifier service that uses the registry and pluggable classifiers.
 */

import { FastifyInstance } from 'fastify';
import { createLogger } from '../../utils/logger.js';
import { ClassifiedIntent, ClassifierOptions, ClassifierService } from './interfaces.js';
import { createClassifierRegistry } from './registry.js';
import { createRulesBasedClassifier } from './classifiers/rules-based.js';
import { createMlBasedClassifier } from './classifiers/ml-based.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a classifier service
 * 
 * @param fastify The Fastify instance
 * @returns A classifier service
 */
export function createClassifierService(fastify: FastifyInstance): ClassifierService {
  logger.debug('Creating classifier service');
  
  // Create the registry
  const registry = createClassifierRegistry();
  
  // Create and register the classifiers
  const rulesBasedClassifier = createRulesBasedClassifier();
  const mlBasedClassifier = createMlBasedClassifier();
  
  // Register both classifiers
  registry.register(rulesBasedClassifier);
  registry.register(mlBasedClassifier);
  
  // Set the rules-based classifier as the default
  registry.setDefault(rulesBasedClassifier.name);
  
  // Return the classifier service
  return {
    registry,
    
    /**
     * Classify a prompt to determine its intent
     * 
     * @param prompt The user prompt
     * @param options Optional options for classification
     * @returns The classified intent
     */
    async classifyPrompt(prompt: string, options?: ClassifierOptions): Promise<ClassifiedIntent> {
      logger.debug('Classifying prompt');
      
      try {
        // Use the registry to classify the prompt
        return await registry.classify(prompt, options);
      } catch (error) {
        fastify.log.error(error, 'Classification failed');
        // Return a default classification if something goes wrong
        return {
          type: 'general',
          complexity: 'medium',
          features: ['text-generation'],
          priority: 'medium',
          confidence: 0.5,
          tokens: {
            estimated: Math.ceil(prompt.length / 4),
            completion: Math.ceil(prompt.length / 4)
          }
        };
      }
    }
  };
}

export default createClassifierService;

// Re-export types and interfaces
export * from './interfaces.js';