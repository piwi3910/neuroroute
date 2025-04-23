/**
 * Classifier Registry
 * 
 * This file contains the registry for classifier implementations.
 */

import { createLogger } from '../../utils/logger.js';
import { Classifier, ClassifierOptions, ClassifiedIntent, ClassifierRegistry } from './interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a classifier registry
 * 
 * @returns A classifier registry
 */
export function createClassifierRegistry(): ClassifierRegistry {
  logger.debug('Creating classifier registry');
  
  // Store registered classifiers
  const classifiers: Classifier[] = [];
  
  // Track the default classifier
  let defaultClassifier: string | undefined;
  
  return {
    /**
     * Register a classifier
     *
     * @param classifier The classifier to register
     */
    register(classifier: Classifier): void {
      logger.debug({ classifier: classifier.name }, 'Registering classifier');
      classifiers.push(classifier);
    },
    
    /**
     * Unregister a classifier
     *
     * @param name The name of the classifier to unregister
     */
    unregister(name: string): void {
      logger.debug({ name }, 'Unregistering classifier');
      const index = classifiers.findIndex(c => c.name === name);
      
      if (index !== -1) {
        classifiers.splice(index, 1);
      }
    },
    
    /**
     * Get all registered classifiers
     *
     * @returns All registered classifiers
     */
    getAll(): Classifier[] {
      return [...classifiers];
    },
    
    /**
     * Get all enabled classifiers
     *
     * @returns All enabled classifiers
     */
    getEnabled(): Classifier[] {
      return classifiers.filter(c => c.isEnabled());
    },
    
    /**
     * Get a classifier by name
     *
     * @param name The name of the classifier to get
     * @returns The classifier, or undefined if not found
     */
    get(name: string): Classifier | undefined {
      return classifiers.find(c => c.name === name);
    },
    
    /**
     * Classify a prompt using the registered classifiers
     * 
     * @param prompt The user prompt
     * @param options Optional options for classification
     * @returns The classified intent
     */
    /**
     * Get the default classifier
     *
     * @returns The default classifier
     */
    getDefault(): Classifier {
      // If a default classifier is set, return it
      if (defaultClassifier) {
        const classifier = classifiers.find(c => c.name === defaultClassifier);
        if (classifier) {
          return classifier;
        }
      }
      
      // If no default classifier is set or it's not found, return the first enabled classifier
      const enabledClassifiers = classifiers.filter(c => c.isEnabled());
      
      if (enabledClassifiers.length === 0) {
        logger.warn('No enabled classifiers found');
        throw new Error('No enabled classifiers found');
      }
      
      return enabledClassifiers[0];
    },
    
    /**
     * Set the default classifier
     *
     * @param name The name of the classifier to set as default
     */
    setDefault(name: string): void {
      const classifier = classifiers.find(c => c.name === name);
      
      if (!classifier) {
        logger.warn({ name }, 'Classifier not found for setting as default');
        throw new Error(`Classifier "${name}" not found`);
      }
      
      defaultClassifier = name;
      logger.debug({ name }, 'Set default classifier');
    },
    
    /**
     * Classify a prompt using the registered classifiers
     *
     * @param prompt The user prompt
     * @param options Optional options for classification
     * @returns The classified intent
     */
    async classify(prompt: string, options?: ClassifierOptions): Promise<ClassifiedIntent> {
      logger.debug('Classifying prompt with registry');
      
      try {
        // Use the default classifier
        const classifier = this.getDefault();
        logger.debug({ classifier: classifier.name }, 'Using classifier');
        
        return await classifier.classify(prompt, options);
      } catch (error) {
        logger.error(error, 'Classification failed');
        throw error;
      }
    }
  };
}

export default createClassifierRegistry;