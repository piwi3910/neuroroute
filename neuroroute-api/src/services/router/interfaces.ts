/**
 * Interfaces for the router service components
 */

import { ClassifiedIntent } from '../classifier/interfaces.js';
import { ModelResponse, ChatMessage, ToolDefinition } from '../../models/base-adapter.js';

/**
 * Routing Strategy interface
 */
export interface RoutingStrategy {
  /**
   * The unique name of the routing strategy.
   */
  name: string;

  /**
   * Routes a prompt to an appropriate model based on classification and options.
   * @param prompt The user prompt.
   * @param classification The result of prompt classification.
   * @param options Optional routing options.
   * @returns A promise resolving to the routing result.
   */
  route(prompt: string, classification: ClassifiedIntent, options?: RoutingOptions): Promise<RoutingResult>;

  /**
   * Checks if the routing strategy is enabled based on options.
   * @param options Optional routing options.
   * @returns True if the strategy is enabled, false otherwise.
   */
  isEnabled(options?: RoutingOptions): boolean;
}

/**
 * Routing options
 */
export interface RoutingOptions {
  costOptimize?: boolean;
  qualityOptimize?: boolean;
  latencyOptimize?: boolean;
  fallbackEnabled?: boolean;
  chainEnabled?: boolean;
  cacheStrategy?: 'default' | 'aggressive' | 'minimal' | 'none';
  cacheTTL?: number;
  fallbackLevels?: number;
  degradedMode?: boolean;
  timeoutMs?: number;
  monitorFallbacks?: boolean;
  // Allow for additional custom options
  [key: string]: any;
}

/**
 * Routing result
 */
export interface RoutingResult {
  /**
   * The ID of the selected model.
   */
  modelId: string;
  /**
   * The provider of the selected model.
   */
  provider: string;
  /**
   * Optional list of fallback model IDs.
   */
  fallbackOptions?: string[];
  /**
   * Optional metadata related to the routing decision.
   */
  metadata?: Record<string, any>;
}

/**
 * Model Information (Copied from original router.ts)
 */
export interface ModelInfo {
  id: string;
  provider: string;
  capabilities: string[];
  cost: number;
  quality: number;
  maxTokens: number;
  available: boolean;
  latency: number;
  priority?: number;
}


/**
 * Normalizer interface
 */
export interface Normalizer {
  /**
   * The unique name of the normalizer.
   */
  name: string;
  /**
   * The provider this normalizer is for (e.g., 'openai', 'anthropic').
   */
  provider: string;

  /**
   * Normalizes a prompt for a specific model.
   * @param prompt The prompt to normalize.
   * @param options Optional normalization options.
   * @returns A promise resolving to the normalized prompt.
   */
  normalize(prompt: string, options?: NormalizationOptions): Promise<string>;

  /**
   * Checks if the normalizer is enabled based on options.
   * @param options Optional normalization options.
   * @returns True if the normalizer is enabled, false otherwise.
   */
  isEnabled(options?: NormalizationOptions): boolean;
}

/**
 * Normalization options
 */
export interface NormalizationOptions {
  modelId?: string;
  // Allow for additional custom options
  [key: string]: any;
}

/**
 * Routing Engine interface
 */
export interface RoutingEngine {
  /**
   * Selects the best model based on prompt classification and routing options.
   * @param prompt The user prompt.
   * @param classification The result of prompt classification.
   * @param options Optional routing options.
   * @returns A promise resolving to the routing result.
   */
  route(prompt: string, classification: ClassifiedIntent, options?: RoutingOptions): Promise<RoutingResult>;

  /**
   * Registers a new routing strategy.
   * @param strategy The routing strategy to register.
   */
  registerStrategy(strategy: RoutingStrategy): void;

  /**
   * Gets a registered routing strategy by name.
   * @param name The name of the strategy.
   * @returns The routing strategy or undefined if not found.
   */
  getStrategy(name: string): RoutingStrategy | undefined;

  /**
   * Gets all registered routing strategies.
   * @returns An array of all registered routing strategies.
   */
  getAllStrategies(): RoutingStrategy[];

  /**
   * Gets all enabled routing strategies.
   * @param options Optional routing options to consider for enablement.
   * @returns All enabled routing strategies.
   */
  getEnabledStrategies(options?: RoutingOptions): RoutingStrategy[];

  /**
   * Set the default routing strategy
   *
   * @param name The name of the strategy to set as default
   */
  setDefaultStrategy(name: string): void;

  /**
   * Get the default routing strategy
   *
   * @returns The default routing strategy
   */
  getDefaultStrategy(): RoutingStrategy;

  /**
   * Select the best routing strategy based on options and classification.
   * If a specific strategy is named in options, use that if enabled.
   * Otherwise, use the default strategy.
   *
   * @param classification Prompt classification.
   * @param options Optional routing options.
   * @returns The selected routing strategy.
   */
  selectStrategy(classification: ClassifiedIntent, options?: RoutingOptions): RoutingStrategy;
}

/**
 * Normalization Engine interface
 */
export interface NormalizationEngine {
  /**
   * Normalizes a prompt for a specific model using appropriate normalizers.
   * @param prompt The prompt to normalize.
   * @param modelId The ID of the target model.
   * @param options Optional normalization options.
   * @returns A promise resolving to the normalized prompt.
   */
  normalize(prompt: string, modelId: string, options?: NormalizationOptions): Promise<string>;

  /**
   * Registers a new normalizer.
   * @param normalizer The normalizer to register.
   */
  registerNormalizer(normalizer: Normalizer): void;

  /**
   * Gets a registered normalizer by name.
   * @param name The name of the normalizer.
   * @returns The normalizer or undefined if not found.
   */
  getNormalizer(name: string): Normalizer | undefined;

  /**
   * Gets all registered normalizers.
   * @returns An array of all registered normalizers.
   */
  getAllNormalizers(): Normalizer[];

  /**
   * Gets all enabled normalizers.
   * @param options Optional normalization options to consider for enablement.
   * @returns All enabled normalizers.
   */
  getEnabledNormalizers(options?: NormalizationOptions): Normalizer[];

  /**
   * Select the appropriate normalizer for a given model ID.
   * Prioritizes a normalizer registered with the exact model ID,
   * then falls back to a normalizer registered with the provider name.
   *
   * @param modelId The ID of the target model.
   * @returns The selected normalizer or undefined if none found.
   */
  selectNormalizer(modelId: string): Normalizer | undefined;
}

/**
 * Refactored Router Service interface
 */
export interface RouterService {
  /**
   * Routes a prompt to the appropriate model and returns the response.
   * @param prompt The user prompt.
   * @param modelId Optional specific model ID to use.
   * @param maxTokens Maximum tokens to generate.
   * @param temperature Sampling temperature.
   * @param options Optional routing options.
   * @returns A promise resolving to the router response.
   */
  routePrompt(
    prompt: string,
    modelId?: string,
    maxTokens?: number,
    temperature?: number,
    options?: RoutingOptions
  ): Promise<RouterResponse>;

  /**
   * Routes a chat completion request to the appropriate model and returns the response.
   * @param messages Array of chat messages.
   * @param modelId Optional specific model ID to use.
   * @param maxTokens Maximum tokens to generate.
   * @param temperature Sampling temperature.
   * @param tools Optional array of tool definitions.
   * @param toolChoice How to use tools ('auto', 'none', or specific tool).
   * @param options Optional routing options.
   * @returns A promise resolving to the chat completion response.
   */
  routeChatCompletion(
    messages: ChatMessage[],
    modelId?: string,
    maxTokens?: number,
    temperature?: number,
    tools?: ToolDefinition[],
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } },
    options?: RoutingOptions
  ): Promise<ModelResponse>; // Using ModelResponse as per base-adapter

  /**
   * Gets the routing engine instance.
   * @returns The routing engine.
   */
  getRoutingEngine(): RoutingEngine;

  /**
   * Gets the normalization engine instance.
   * @returns The normalization engine.
   */
  getNormalizationEngine(): NormalizationEngine;
}

/**
 * Router service response
 */
export interface RouterResponse {
  response: string;
  model_used: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cached?: boolean;
  classification?: {
    intent: string;
    confidence: number;
    features?: string[];
    domain?: string;
  };
  processing_time?: number;
  cost?: number;
  model_chain?: string[];
  functionCall?: any;
  toolCalls?: any[];
  messages?: ChatMessage[];
}

/**
 * Chat completion response (using ModelResponse from base-adapter)
 */
export interface ChatCompletionResponse extends ModelResponse {
  id?: string; // Ensure id property exists
  created?: number; // Ensure created property exists
  cached?: boolean;
}

// Re-export types from base-adapter for convenience
export type { ModelRequestOptions, ChatMessage, ToolDefinition, ModelResponse } from '../../models/base-adapter.js';