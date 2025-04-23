/**
 * Preprocessor Service
 *
 * This is the main entry point for the preprocessor service.
 */

import { createLogger } from '../../utils/logger.js';
import { createPreprocessorRegistry } from './registry.js';
import { createSanitizationPreprocessor } from './processors/sanitization.js';
import { createCompressionPreprocessor } from './processors/compression.js';
import { createReplacementPreprocessor } from './processors/replacement.js';
import { Preprocessor, PreprocessorOptions } from './interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Preprocessor Service interface
 */
export interface PreprocessorService {
  /**
   * Process a prompt through the preprocessor pipeline
   *
   * @param prompt The prompt to process
   * @param options Options for the preprocessors
   * @returns The processed prompt
   */
  process(prompt: string, options?: PreprocessorOptions): Promise<string>;
  
  /**
   * Register a preprocessor
   *
   * @param preprocessor The preprocessor to register
   */
  registerPreprocessor(preprocessor: Preprocessor): void;
  
  /**
   * Get a preprocessor by name
   *
   * @param name The name of the preprocessor
   * @returns The preprocessor, or undefined if not found
   */
  getPreprocessor(name: string): Preprocessor | undefined;
  
  /**
   * Get all registered preprocessors
   *
   * @returns All registered preprocessors
   */
  getAllPreprocessors(): Preprocessor[];
}

/**
 * Create a preprocessor service
 *
 * @returns A preprocessor service
 */
export function createPreprocessorService(): PreprocessorService {
  logger.debug('Creating preprocessor service');
  
  // Create the registry
  const registry = createPreprocessorRegistry();
  
  // Register the preprocessors
  registry.register(createSanitizationPreprocessor());
  registry.register(createCompressionPreprocessor());
  registry.register(createReplacementPreprocessor());
  
  logger.debug('Preprocessor service created');
  
  return {
    /**
     * Process a prompt through the preprocessor pipeline
     *
     * @param prompt The prompt to process
     * @param options Options for the preprocessors
     * @returns The processed prompt
     */
    async process(prompt: string, options?: PreprocessorOptions): Promise<string> {
      logger.debug('Processing prompt through preprocessor service');
      return registry.process(prompt, options);
    },
    
    /**
     * Register a preprocessor
     *
     * @param preprocessor The preprocessor to register
     */
    registerPreprocessor(preprocessor: Preprocessor): void {
      logger.debug(`Registering preprocessor: ${preprocessor.name}`);
      registry.register(preprocessor);
    },
    
    /**
     * Get a preprocessor by name
     *
     * @param name The name of the preprocessor
     * @returns The preprocessor, or undefined if not found
     */
    getPreprocessor(name: string): Preprocessor | undefined {
      return registry.get(name);
    },
    
    /**
     * Get all registered preprocessors
     *
     * @returns All registered preprocessors
     */
    getAllPreprocessors(): Preprocessor[] {
      return registry.getAll();
    }
  };
}

// Export the interfaces and processors
export * from './interfaces.js';
export * from './processors/sanitization.js';
export * from './processors/compression.js';
export * from './processors/replacement.js';