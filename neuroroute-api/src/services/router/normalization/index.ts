/**
 * Normalization Engine
 *
 * This file contains the main normalization engine that uses the normalizer registry.
 */

import { createLogger } from '../../../utils/logger.js';
import { NormalizationEngine, NormalizationOptions, Normalizer } from '../interfaces.js';
import { createNormalizerRegistry } from './registry.js';
// TODO: Import default normalizers here

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a normalization engine
 *
 * @returns A normalization engine
 */
export function createNormalizationEngine(): NormalizationEngine {
  logger.debug('Creating normalization engine');

  // Create the registry
  const registry = createNormalizerRegistry();

  // TODO: Register default normalizers here

  logger.debug('Normalization engine created');

  return {
    /**
     * Normalizes a prompt for a specific model using appropriate normalizers.
     * @param prompt The prompt to normalize.
     * @param modelId The ID of the target model.
     * @param options Optional normalization options.
     * @returns A promise resolving to the normalized prompt.
     */
    async normalize(prompt: string, modelId: string, options?: NormalizationOptions): Promise<string> {
      logger.debug({ modelId }, 'Normalizing prompt with normalization engine');

      try {
        // Select the appropriate normalizer for the model
        const normalizer = registry.selectNormalizer(modelId);

        // If a normalizer is found and enabled, use it
        if (normalizer?.isEnabled(options)) {
          logger.debug({ modelId, normalizer: normalizer.name }, 'Using normalizer');
          return await normalizer.normalize(prompt, options);
        }

        logger.debug({ modelId }, 'No enabled normalizer found for model, returning original prompt');
        return prompt; // Return original prompt if no normalizer is found or enabled
      } catch (error) {
        logger.error(error, 'Normalization failed');
        // Depending on requirements, you might want to throw the error or return the original prompt
        throw error;
      }
    },

    /**
     * Registers a new normalizer.
     * @param normalizer The normalizer to register.
     */
    registerNormalizer(normalizer: Normalizer): void {
      registry.registerNormalizer(normalizer);
    },

    /**
     * Gets a registered normalizer by name.
     * @param name The name of the normalizer.
     * @returns The normalizer or undefined if not found.
     */
    getNormalizer(name: string): Normalizer | undefined {
      return registry.getNormalizer(name);
    },

    /**
     * Gets all registered normalizers.
     * @returns An array of all registered normalizers.
     */
    getAllNormalizers(): Normalizer[] {
      return registry.getAllNormalizers();
    },

    /**
     * Gets all enabled normalizers.
     * @param options Optional normalization options to consider for enablement.
     * @returns All enabled normalizers.
     */
    getEnabledNormalizers(options?: NormalizationOptions): Normalizer[] {
      return registry.getEnabledNormalizers(options);
    },

    /**
     * Select the appropriate normalizer for a given model ID.
     * Prioritizes a normalizer registered with the exact model ID,
     * then falls back to a normalizer registered with the provider name.
     *
     * @param modelId The ID of the target model.
     * @returns The selected normalizer or undefined if none found.
     */
    selectNormalizer(modelId: string): Normalizer | undefined {
      return registry.selectNormalizer(modelId);
    }
  };
}

export type { NormalizationEngine };