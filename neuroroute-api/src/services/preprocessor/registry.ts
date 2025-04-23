/**
 * Preprocessor Registry
 * 
 * This file contains the implementation of the preprocessor registry.
 */

import { createLogger } from '../../utils/logger.js';
import { Preprocessor, PreprocessorOptions, PreprocessorRegistry } from './interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a preprocessor registry
 * 
 * @returns A preprocessor registry
 */
export function createPreprocessorRegistry(): PreprocessorRegistry {
  logger.debug('Creating preprocessor registry');
  
  // Store preprocessors in a map for quick lookup by name
  const preprocessors = new Map<string, Preprocessor>();
  
  return {
    /**
     * Register a preprocessor
     * 
     * @param preprocessor The preprocessor to register
     */
    register(preprocessor: Preprocessor): void {
      logger.debug(`Registering preprocessor: ${preprocessor.name}`);
      
      if (preprocessors.has(preprocessor.name)) {
        logger.warn(`Preprocessor with name ${preprocessor.name} already registered, overwriting`);
      }
      
      preprocessors.set(preprocessor.name, preprocessor);
    },
    
    /**
     * Get a preprocessor by name
     * 
     * @param name The name of the preprocessor
     * @returns The preprocessor, or undefined if not found
     */
    get(name: string): Preprocessor | undefined {
      return preprocessors.get(name);
    },
    
    /**
     * Get all registered preprocessors
     * 
     * @returns All registered preprocessors
     */
    getAll(): Preprocessor[] {
      return Array.from(preprocessors.values());
    },
    
    /**
     * Process a prompt through all registered preprocessors
     * 
     * @param prompt The prompt to process
     * @param options Options for the preprocessors
     * @returns The processed prompt
     */
    async process(prompt: string, options?: PreprocessorOptions): Promise<string> {
      logger.debug('Processing prompt through preprocessor registry');
      
      if (!prompt) {
        return '';
      }
      
      let result = prompt;
      
      // Process the prompt through each preprocessor in the order they were registered
      for (const preprocessor of preprocessors.values()) {
        // Check if the preprocessor is enabled
        if (preprocessor.isEnabled(options)) {
          logger.debug(`Processing prompt with preprocessor: ${preprocessor.name}`);
          
          try {
            // Process the prompt
            result = await preprocessor.process(result, options);
          } catch (error) {
            logger.error(`Error processing prompt with preprocessor ${preprocessor.name}`, error);
            // Continue with the next preprocessor
          }
        } else {
          logger.debug(`Skipping disabled preprocessor: ${preprocessor.name}`);
        }
      }
      
      logger.debug('Prompt processing complete');
      return result;
    }
  };
}