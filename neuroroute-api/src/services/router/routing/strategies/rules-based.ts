/**
 * Rules-based Routing Strategy
 *
 * This is a placeholder for the rules-based routing strategy.
 */

import { RoutingStrategy, RoutingOptions, RoutingResult } from '../../interfaces.js';
import { ClassifiedIntent } from '../../../classifier/interfaces.js';

/**
 * Create a rules-based routing strategy
 *
 * @returns A rules-based routing strategy
 */
export function createRulesBasedRoutingStrategy(): RoutingStrategy {
  return {
    name: 'rules-based',
    async route(prompt: string, classification: ClassifiedIntent, options?: RoutingOptions): Promise<RoutingResult> {
      // TODO: Implement rules-based routing logic here
      console.log('Rules-based routing strategy invoked');
      console.log('Prompt:', prompt);
      console.log('Classification:', classification);
      console.log('Options:', options);

      // Placeholder implementation: always route to gpt-4 for now
      return {
        modelId: 'gpt-4',
        provider: 'openai',
        fallbackOptions: ['claude-3-7-sonnet-latest', 'lmstudio-local']
      };
    },
    isEnabled(options?: RoutingOptions): boolean {
      // TODO: Implement enablement logic based on options
      return true; // Always enabled for now
    }
  };
}