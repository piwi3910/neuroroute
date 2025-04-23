/**
 * Normalizer Registry
 *
 * This file contains the implementation of the normalizer registry.
 */

import { createLogger } from '../../../utils/logger.js';
import { Normalizer, NormalizationOptions, NormalizationEngine } from '../interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a normalizer registry
 *
 * @returns A normalizer registry
 */
export function createNormalizerRegistry(): Omit<NormalizationEngine, 'normalize'> {
  logger.debug('Creating normalizer registry');

  // Store normalizers in a map for quick lookup by provider/model
  const normalizers = new Map<string, Normalizer>(); // Key: provider or modelId

  return {
    /**
     * Register a normalizer
     *
     * @param normalizer The normalizer to register
     */
    registerNormalizer(normalizer: Normalizer): void {
      logger.debug({ normalizer: normalizer.name, provider: normalizer.provider }, 'Registering normalizer');

      // Use provider as the primary key, but allow model-specific overrides
      const key = normalizer.provider;
      if (normalizers.has(key)) {
        logger.warn(`Normalizer for provider ${normalizer.provider} already registered, overwriting`);
      }
      normalizers.set(key, normalizer);

      // If the normalizer has a specific name (e.g., model ID), register it by name as well
      if (normalizer.name !== normalizer.provider) {
         if (normalizers.has(normalizer.name)) {
            logger.warn(`Normalizer with name ${normalizer.name} already registered, overwriting`);
         }
         normalizers.set(normalizer.name, normalizer);
      }
    },

    /**
     * Get a normalizer by name
     *
     * @param name The name of the normalizer
     * @returns The normalizer, or undefined if not found
     */
    getNormalizer(name: string): Normalizer | undefined {
      return normalizers.get(name);
    },

    /**
     * Get all registered normalizers
     *
     * @returns All registered normalizers
     */
    getAllNormalizers(): Normalizer[] {
      return Array.from(normalizers.values());
    },

    /**
     * Get all enabled normalizers
     *
     * @param options Optional normalization options to consider for enablement.
     * @returns All enabled normalizers.
     */
    getEnabledNormalizers(options?: NormalizationOptions): Normalizer[] {
      return Array.from(normalizers.values()).filter(normalizer => normalizer.isEnabled(options));
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
      // Try to find a normalizer registered with the exact model ID
      const modelSpecificNormalizer = normalizers.get(modelId);
      if (modelSpecificNormalizer) {
        logger.debug({ modelId }, 'Using model-specific normalizer');
        return modelSpecificNormalizer;
      }

      // If no model-specific normalizer, try to find one registered with the provider name
      // We need to get the provider from the model ID. This assumes model IDs are in the format provider/model-name or similar.
      // A more robust solution might involve a model configuration service.
      const provider = modelId.split('/')[0]; // Simple split for now
      const providerNormalizer = normalizers.get(provider);
      if (providerNormalizer) {
        logger.debug({ modelId, provider }, 'Using provider-specific normalizer');
        return providerNormalizer;
      }

      logger.debug({ modelId }, 'No specific normalizer found for model or provider, using no normalization');
      return undefined; // No specific normalizer found
    }
  };
}