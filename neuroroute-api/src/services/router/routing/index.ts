/**
 * Routing Engine
 *
 * This file contains the main routing engine that uses the strategy registry.
 */

import { createLogger } from '../../../utils/logger.js';
import { RoutingEngine, RoutingOptions, RoutingResult, RoutingStrategy } from '../interfaces.js';
import { ClassifiedIntent } from '../../classifier/interfaces.js';
import { createRoutingStrategyRegistry } from './registry.js';
import { createRulesBasedRoutingStrategy } from './strategies/rules-based.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a routing engine
 *
 * @returns A routing engine
 */
export function createRoutingEngine(): RoutingEngine {
  logger.debug('Creating routing engine');

  // Create the registry
  const registry = createRoutingStrategyRegistry();

  // Create and register the default rules-based strategy
  const rulesBasedStrategy = createRulesBasedRoutingStrategy();
  registry.registerStrategy(rulesBasedStrategy);
  registry.setDefaultStrategy(rulesBasedStrategy.name);

  // TODO: Register other routing strategies here

  logger.debug('Routing engine created');

  return {
    /**
     * Selects the best model based on prompt classification and routing options.
     * @param prompt The user prompt.
     * @param classification The result of prompt classification.
     * @param options Optional routing options.
     * @returns A promise resolving to the routing result.
     */
    async route(prompt: string, classification: ClassifiedIntent, options?: RoutingOptions): Promise<RoutingResult> {
      logger.debug('Routing prompt with routing engine');

      try {
        // Select the appropriate routing strategy
        const strategy = registry.selectStrategy(classification, options);
        logger.debug({ strategy: strategy.name }, 'Using routing strategy');

        // Execute the selected strategy
        return await strategy.route(prompt, classification, options);
      } catch (error) {
        logger.error(error, 'Routing failed');
        throw error;
      }
    },

    /**
     * Registers a new routing strategy.
     * @param strategy The routing strategy to register.
     */
    registerStrategy(strategy: RoutingStrategy): void {
      registry.registerStrategy(strategy);
    },

    /**
     * Gets a registered routing strategy by name.
     * @param name The name of the strategy.
     * @returns The strategy or undefined if not found.
     */
    getStrategy(name: string): RoutingStrategy | undefined {
      return registry.getStrategy(name);
    },

    /**
     * Gets all registered routing strategies.
     * @returns All registered routing strategies.
     */
    getAllStrategies(): RoutingStrategy[] {
      return registry.getAllStrategies();
    },

    /**
     * Gets all enabled routing strategies.
     * @param options Optional routing options to consider for enablement.
     * @returns All enabled routing strategies.
     */
    getEnabledStrategies(options?: RoutingOptions): RoutingStrategy[] {
      return registry.getEnabledStrategies(options);
    },

    /**
     * Set the default routing strategy
     *
     * @param name The name of the strategy to set as default
     */
    setDefaultStrategy(name: string): void {
      registry.setDefaultStrategy(name);
    },

    /**
     * Get the default routing strategy
     *
     * @returns The default routing strategy
     */
    getDefaultStrategy(): RoutingStrategy {
      return registry.getDefaultStrategy();
    },

    /**
     * Select the best routing strategy based on options and classification.
     * If a specific strategy is named in options, use that if enabled.
     * Otherwise, use the default strategy.
     *
     * @param classification Prompt classification.
     * @param options Optional routing options.
     * @returns The selected routing strategy.
     */
    selectStrategy(classification: ClassifiedIntent, options?: RoutingOptions): RoutingStrategy {
      return registry.selectStrategy(classification, options);
    }
  };


}

export type { RoutingEngine };