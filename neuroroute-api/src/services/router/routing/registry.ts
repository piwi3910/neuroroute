/**
 * Routing Strategy Registry
 *
 * This file contains the implementation of the routing strategy registry.
 */

import { createLogger } from '../../../utils/logger.js';
import { RoutingStrategy, RoutingOptions, RoutingEngine } from '../interfaces.js';
import { ClassifiedIntent } from '../../classifier/interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a routing strategy registry
 *
 * @returns A routing strategy registry
 */
export function createRoutingStrategyRegistry(): Omit<RoutingEngine, 'route'> {
  logger.debug('Creating routing strategy registry');

  // Store routing strategies in a map for quick lookup by name
  const strategies = new Map<string, RoutingStrategy>();

  // Track the default strategy
  let defaultStrategy: string | undefined;

  return {
    /**
     * Register a routing strategy
     *
     * @param strategy The strategy to register
     */
    registerStrategy(strategy: RoutingStrategy): void {
      logger.debug({ strategy: strategy.name }, 'Registering routing strategy');

      if (strategies.has(strategy.name)) {
        logger.warn(`Routing strategy with name ${strategy.name} already registered, overwriting`);
      }

      strategies.set(strategy.name, strategy);
    },

    /**
     * Get a routing strategy by name
     *
     * @param name The name of the strategy
     * @returns The strategy, or undefined if not found
     */
    getStrategy(name: string): RoutingStrategy | undefined {
      return strategies.get(name);
    },

    /**
     * Get all registered routing strategies
     *
     * @returns All registered routing strategies
     */
    getAllStrategies(): RoutingStrategy[] {
      return Array.from(strategies.values());
    },

    /**
     * Get all enabled routing strategies
     *
     * @param options Optional routing options to consider for enablement.
     * @returns All enabled routing strategies.
     */
    getEnabledStrategies(options?: RoutingOptions): RoutingStrategy[] {
      return Array.from(strategies.values()).filter(strategy => strategy.isEnabled(options));
    },

    /**
     * Set the default routing strategy
     *
     * @param name The name of the strategy to set as default
     */
    setDefaultStrategy(name: string): void {
      const strategy = strategies.get(name);

      if (!strategy) {
        logger.warn({ name }, 'Routing strategy not found for setting as default');
        throw new Error(`Routing strategy "${name}" not found`);
      }

      defaultStrategy = name;
      logger.debug({ name }, 'Set default routing strategy');
    },

    /**
     * Get the default routing strategy
     *
     * @returns The default routing strategy
     */
    getDefaultStrategy(): RoutingStrategy {
      // If a default strategy is set, return it
      if (defaultStrategy) {
        const strategy = strategies.get(defaultStrategy);
        if (strategy) {
          return strategy;
        }
      }

      // If no default strategy is set or it's not found, return the first enabled strategy
      const enabledStrategies = this.getEnabledStrategies();

      if (enabledStrategies.length === 0) {
        logger.warn('No enabled routing strategies found');
        throw new Error('No enabled routing strategies found');
      }

      return enabledStrategies[0];
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
      // If a specific strategy is requested and enabled, use it
      if (options?.strategyName) {
        const namedStrategy = this.getStrategy(options.strategyName);
        if (namedStrategy?.isEnabled(options)) {
          logger.debug({ strategy: namedStrategy.name }, 'Using named routing strategy');
          return namedStrategy;
        } else if (options?.strategyName) {
          logger.warn({ strategy: options.strategyName }, 'Named routing strategy not found or not enabled, falling back to default');
        }
      }

      // Otherwise, use the default strategy
      const defaultStrategy = this.getDefaultStrategy();
      logger.debug({ strategy: defaultStrategy.name }, 'Using default routing strategy');
      return defaultStrategy;
    }
  };
}