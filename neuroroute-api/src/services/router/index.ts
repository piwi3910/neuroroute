/**
 * Router Service
 *
 * This is the main entry point for the refactored router service,
 * which orchestrates the Routing Engine and Normalization Engine.
 */

import { FastifyInstance } from 'fastify';
import { createLogger } from '../../utils/logger.js';
import type { RouterService as RouterServiceInterface, RouterResponse, RoutingOptions, ChatCompletionResponse, ModelRequestOptions, ChatMessage, ToolDefinition, ModelResponse, ModelInfo } from './interfaces.js';
import { createRoutingEngine, type RoutingEngine } from './routing/index.js';
import { createNormalizationEngine, type NormalizationEngine } from './normalization/index.js';
import createCacheService from '../cache.js';
import crypto from 'crypto';
import { trackModelUsage } from '../../utils/logger.js'; // Keep this import
import { getModelAdapter } from '../../models/adapter-registry.js';
import { errors } from '../../utils/error-handler.js';
import type { ClassifiedIntent } from '../classifier/interfaces.js';
import createClassifierService from '../classifier/index.js';
// Import the necessary modules

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

// Helper interface for fallback result
interface FallbackResult {
  success: boolean;
  response?: RouterResponse;
  error?: Error;
}

/**
 * Router service class implementing the main logic.
 */
export class RouterService { // Removed implements clause
  private fastify: FastifyInstance;
  private classifier: ReturnType<typeof createClassifierService>;
  private routingEngine: RoutingEngine;
  private normalizationEngine: NormalizationEngine;
  private cache: ReturnType<typeof createCacheService>;
  private models: Record<string, ModelInfo>;
  private defaultOptions: RoutingOptions;
  private modelAvailability: Map<string, boolean>;
  private modelLatencies: Map<string, number[]>;
  private fallbackAttempts: Map<string, number>;
  private fallbackAlerts: Set<string>;
  private degradedModeEnabled: boolean;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.classifier = createClassifierService(fastify);
    this.routingEngine = createRoutingEngine();
    this.normalizationEngine = createNormalizationEngine();

    const config = (fastify as unknown as { config?: Record<string, unknown> }).config ?? {};
    const cacheTTL = (config.REDIS_CACHE_TTL as number) ?? 300;

    this.cache = createCacheService(fastify, {
      namespace: 'router',
      ttl: cacheTTL,
    });

    this.models = {};
    this.modelAvailability = new Map();
    this.modelLatencies = new Map();

    this.defaultOptions = {
      costOptimize: (config.COST_OPTIMIZE as boolean) ?? false,
      qualityOptimize: (config.QUALITY_OPTIMIZE as boolean) ?? true,
      latencyOptimize: (config.LATENCY_OPTIMIZE as boolean) ?? false,
      fallbackEnabled: (config.FALLBACK_ENABLED as boolean) ?? true,
      chainEnabled: (config.CHAIN_ENABLED as boolean) ?? false,
      cacheStrategy: (config.CACHE_STRATEGY as 'default' | 'aggressive' | 'minimal' | 'none') ?? 'default',
      cacheTTL: cacheTTL,
      fallbackLevels: parseInt((config.FALLBACK_LEVELS as string) ?? '2', 10),
      degradedMode: (config.DEGRADED_MODE as string) === 'true',
      timeoutMs: parseInt((config.REQUEST_TIMEOUT_MS as string) ?? '30000', 10),
      monitorFallbacks: (config.MONITOR_FALLBACKS as string) !== 'false'
    };

    this.fallbackAttempts = new Map();
    this.fallbackAlerts = new Set();
    this.degradedModeEnabled = this.defaultOptions.degradedMode ?? false;

    void this.loadModelConfigurations();
    this.startModelHealthChecks();
    logger.debug('Router service initialized');
  }

  async routePrompt(
    prompt: string,
    modelId?: string,
    maxTokens = 1024,
    temperature = 0.7,
    options?: RoutingOptions
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    try {
      const routingOptions: RoutingOptions = { ...this.defaultOptions, ...options };
      const cacheKey = this.generateCacheKey(prompt, modelId, maxTokens, temperature);

      if (routingOptions.cacheStrategy !== 'none') {
        const cachedResponse = await this.cache.get<RouterResponse>(cacheKey);
        if (cachedResponse) {
          logger.info({ cacheKey, modelId: cachedResponse.model_used, strategy: routingOptions.cacheStrategy }, 'Cache hit for prompt');
          return { ...cachedResponse, cached: true };
        }
      }

      const classification = await this.classifier.classifyPrompt(prompt);

      if (routingOptions.chainEnabled && this.shouldUseModelChain(classification)) {
        return this.executeModelChain(prompt, classification, maxTokens, temperature);
      }

      let selectedModelId: string;
      if (modelId && this.isModelAvailable(modelId)) {
        selectedModelId = modelId;
        logger.debug({ selectedModelId }, 'Using specified model ID');
      } else {
        // Use selectModel method (which should be moved to strategy later)
        // Use the routing engine to select the model
        const routingResult = await this.routingEngine.route(prompt, classification, routingOptions);
        selectedModelId = routingResult.modelId;
        logger.debug({ classification, selectedModelId, routingOptions }, 'Prompt classified and model selected by routing engine');
      }

      let finalResponse: RouterResponse;
      if (!this.isModelAvailable(selectedModelId) && routingOptions.fallbackEnabled) {
        const fallbackResult = await this.executeFallbackStrategy(selectedModelId, prompt, classification, maxTokens, temperature, routingOptions);
        if (fallbackResult.success && fallbackResult.response) {
          finalResponse = fallbackResult.response;
        } else if (this.degradedModeEnabled || routingOptions.degradedMode) {
          finalResponse = this.createDegradedResponse(prompt, classification, fallbackResult.error);
        } else {
          throw errors.router.allModelsFailed('All models failed', { originalModel: selectedModelId, error: fallbackResult.error?.message });
        }
      } else if (!this.isModelAvailable(selectedModelId)) {
        // TODO: Add modelUnavailable error to error-handler.ts
        throw errors.router.modelUnavailable(`Selected model ${selectedModelId} is not available`, { modelId: selectedModelId });
        throw new Error(`Selected model ${selectedModelId} is not available`); // Placeholder
      } else {
        // Use the normalization engine to normalize the prompt
        const normalizedPrompt = await this.normalizationEngine.normalize(prompt, selectedModelId, { modelId: selectedModelId });
        logger.debug({ selectedModelId }, 'Prompt normalized by normalization engine');
        const modelResponse = await this.sendToModel(selectedModelId, normalizedPrompt, maxTokens, temperature);
        finalResponse = {
          response: modelResponse.text,
          model_used: modelResponse.model,
          tokens: modelResponse.tokens,
          cached: false,
          functionCall: modelResponse.functionCall,
          toolCalls: modelResponse.toolCalls,
          messages: modelResponse.messages
        };
      }

      finalResponse.classification = {
        intent: classification.type,
        confidence: classification.confidence,
        features: classification.features,
        domain: classification.domain
      };
      finalResponse.processing_time = Date.now() - startTime;
      if (this.models[finalResponse.model_used]) {
        const costPerToken = this.models[finalResponse.model_used].cost / 1000;
        finalResponse.cost = (finalResponse.tokens.total * costPerToken);
      }

      if (routingOptions.cacheStrategy !== 'none' && !finalResponse.cached) {
         const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
         await this.cache.set(cacheKey, finalResponse, ttl);
      }
      return finalResponse;
    } catch (error) {
      logger.error({ error, prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''), modelId }, 'Failed to route prompt');
      if (error instanceof Error) throw error;
      throw new Error(`Failed to route prompt: ${String(error)}`);
    }
  }

  async routeChatCompletion(
    messages: ChatMessage[],
    modelId?: string,
    maxTokens = 1024,
    temperature = 0.7,
    tools?: ToolDefinition[],
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } },
    options?: RoutingOptions
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    try {
      let userPrompt = '';
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user' && messages[i].content) {
          userPrompt = messages[i].content!;
          break;
        }
      }
      if (!userPrompt) throw errors.router.invalidRequest('No user message found', { messageCount: messages.length });

      const routingOptions: RoutingOptions = { ...this.defaultOptions, ...options };
      const messagesJson = JSON.stringify(messages);
      const cacheKey = this.generateCacheKey(messagesJson, modelId, maxTokens, temperature, tools ? JSON.stringify(tools) : undefined, toolChoice ? JSON.stringify(toolChoice) : undefined);

      if (routingOptions.cacheStrategy !== 'none') {
        const cachedResponse = await this.cache.get<ChatCompletionResponse>(cacheKey);
        if (cachedResponse) {
          logger.info({ cacheKey, modelId: cachedResponse.model, strategy: routingOptions.cacheStrategy }, 'Cache hit for chat completion');
          const response: ChatCompletionResponse = { ...cachedResponse, cached: true };
          // Ensure id and created are present if expected by the interface
          response.id = response.id ?? `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
          response.created = response.created ?? Math.floor(Date.now() / 1000);
          return response;
        }
      }

      const classification = await this.classifier.classifyPrompt(userPrompt);

      let selectedModelId: string;
      if (modelId && this.isModelAvailable(modelId)) {
        selectedModelId = modelId;
        logger.debug({ selectedModelId }, 'Using specified model ID for chat');
      } else {
        // Use the routing engine to select the model
        const routingResult = await this.routingEngine.route(userPrompt, classification, routingOptions);
        selectedModelId = routingResult.modelId;
        logger.debug({ classification, selectedModelId, routingOptions }, 'Chat classified and model selected by routing engine');
      }

      let finalModelResponse: ModelResponse;
      if (!this.isModelAvailable(selectedModelId) && routingOptions.fallbackEnabled) {
         logger.warn({ selectedModelId }, 'Primary model unavailable, attempting fallback for chat');
         const fallbackResult = await this.executeFallbackStrategy(selectedModelId, userPrompt, classification, maxTokens, temperature, routingOptions);
         if (fallbackResult.success && fallbackResult.response) {
            const fallbackModelId = fallbackResult.response.model_used;
            finalModelResponse = await this.sendToModel(fallbackModelId, userPrompt, maxTokens, temperature, messages, tools, toolChoice);
            finalModelResponse.model = fallbackModelId;
         } else if (this.degradedModeEnabled || routingOptions.degradedMode) {
            const degraded = this.createDegradedResponse(userPrompt, classification, fallbackResult.error);
            finalModelResponse = { text: degraded.response, model: degraded.model_used, tokens: degraded.tokens, processingTime: 0, messages: [...messages, { role: 'assistant', content: degraded.response }] };
         } else {
            throw errors.router.allModelsFailed('All models failed chat', { originalModel: selectedModelId, error: fallbackResult.error?.message });
         }
      } else if (!this.isModelAvailable(selectedModelId)) {
        // TODO: Add modelUnavailable error to error-handler.ts
        throw errors.router.modelUnavailable(`Selected model ${selectedModelId} is not available for chat`, { modelId: selectedModelId });
         throw new Error(`Selected model ${selectedModelId} is not available for chat`); // Placeholder
      } else {
        // Use the normalization engine to normalize the prompt
        const normalizedPrompt = await this.normalizationEngine.normalize(userPrompt, selectedModelId, { modelId: selectedModelId });
        logger.debug({ selectedModelId }, 'Chat prompt normalized by normalization engine');
        finalModelResponse = await this.sendToModel(selectedModelId, normalizedPrompt, maxTokens, temperature, messages, tools, toolChoice);
      }

      const chatResponse = { // Remove explicit type here, cast later
        ...finalModelResponse,
        id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
        created: Math.floor(Date.now() / 1000),
        processingTime: Date.now() - startTime,
        cached: false,
        // TODO: Calculate cost
      };

      if (routingOptions.cacheStrategy !== 'none' && !chatResponse.cached) {
         const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
         await this.cache.set(cacheKey, chatResponse, ttl);
      }
      return chatResponse as ChatCompletionResponse; // Explicitly cast return value
    } catch (error) {
      logger.error({ error, messageCount: messages.length, modelId }, 'Failed to route chat completion');
      if (error instanceof Error) throw error;
      throw new Error(`Failed to route chat completion: ${String(error)}`);
    }
  }

  getRoutingEngine(): RoutingEngine { return this.routingEngine; }
  getNormalizationEngine(): NormalizationEngine { return this.normalizationEngine; }

  private startModelHealthChecks(): void {
    setInterval(() => { void this.checkModelAvailability(); }, 5 * 60 * 1000);
    setInterval(() => { void this.loadModelConfigurations(); }, 15 * 60 * 1000);
    setInterval(() => { this.fallbackAttempts.clear(); this.fallbackAlerts.clear(); }, 60 * 60 * 1000);
  }

  private async loadModelConfigurations(): Promise<void> {
    try {
      const configManager = (this.fastify as any).configManager; // Rely on Fastify decoration augmentation
      if (configManager) {
        const modelConfigs = await configManager.getAllModelConfigs();
        if (modelConfigs?.length) {
          const newModels: Record<string, ModelInfo> = {};
          for (const config of modelConfigs) {
            if (config.enabled) {
              newModels[config.id] = {
                id: config.id, provider: config.provider, capabilities: config.capabilities,
                cost: config.config.cost ?? 0, quality: config.config.quality ?? 0.5,
                maxTokens: config.config.maxTokens ?? 4096, available: true,
                latency: config.config.latency ?? 2000, priority: config.priority
              };
            }
          }
          if (Object.keys(newModels).length > 0) {
            for (const modelId of Object.keys(newModels)) {
              if (this.models[modelId]) {
                newModels[modelId].available = this.models[modelId].available;
                const latencies = this.modelLatencies.get(modelId);
                if (latencies?.length) newModels[modelId].latency = latencies.reduce((s, v) => s + v, 0) / latencies.length;
              }
              if (!this.modelLatencies.has(modelId)) this.modelLatencies.set(modelId, []);
            }
            this.models = newModels;
            logger.info({ modelCount: Object.keys(this.models).length }, 'Loaded model configurations');
            void this.checkModelAvailability();
            return;
          }
        }
      }
      if (Object.keys(this.models).length === 0) {
        this.loadDefaultModels();
        logger.warn('Using default model configurations');
      }
    } catch (error) {
      logger.error(error, 'Failed to load model configurations');
      if (Object.keys(this.models).length === 0) {
        this.loadDefaultModels();
        logger.warn('Using default model configurations due to error');
      }
    }
  }

  private loadDefaultModels(): void {
    this.models = {
      'gpt-4.1': { id: 'gpt-4.1', provider: 'openai', capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'], cost: 0.03, quality: 0.95, maxTokens: 8192, available: true, latency: 2000, priority: 3 },
      'claude-3-7-sonnet-latest': { id: 'claude-3-7-sonnet-latest', provider: 'anthropic', capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'], cost: 0.025, quality: 0.95, maxTokens: 200000, available: true, latency: 2000, priority: 3 },
      'lmstudio-local': { id: 'lmstudio-local', provider: 'local', capabilities: ['text-generation', 'code-generation'], cost: 0.0, quality: 0.75, maxTokens: 4096, available: true, latency: 3000, priority: 0 }
    };
    this.modelAvailability = new Map();
    this.modelLatencies = new Map();
    Object.keys(this.models).forEach(id => this.modelLatencies.set(id, []));
    logger.debug('Loaded default models');
  }

  private async checkModelAvailability(): Promise<void> {
    for (const modelId of Object.keys(this.models)) {
      try {
        const adapter = getModelAdapter(this.fastify, modelId);
        const isAvailable = await adapter.isAvailable();
        this.modelAvailability.set(modelId, isAvailable);
        if (this.models[modelId]) this.models[modelId].available = isAvailable;
      } catch (error) {
        logger.error({ modelId, error }, 'Model availability check failed');
        this.modelAvailability.set(modelId, false);
        if (this.models[modelId]) this.models[modelId].available = false;
      }
    }
  }

  private updateModelLatency(modelId: string, latency: number): void {
    const latencies = this.modelLatencies.get(modelId) ?? [];
    if (latencies.length >= 10) latencies.shift();
    latencies.push(latency);
    this.modelLatencies.set(modelId, latencies);
    const avgLatency = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    if (this.models[modelId]) this.models[modelId].latency = avgLatency;
  }

  private isModelAvailable(modelId: string): boolean {
    return this.modelAvailability.get(modelId) ?? false;
  }

  private shouldUseModelChain(classification: ClassifiedIntent): boolean {
    return (classification.complexity === 'complex' || classification.complexity === 'very-complex') &&
           (classification.type === 'analytical' || classification.features.length >= 3);
  }

  private async executeModelChain(prompt: string, classification: ClassifiedIntent, maxTokens: number, temperature: number): Promise<RouterResponse> {
    const startTime = Date.now();
    let modelChain: string[] = ['gpt-4.1', 'claude-3-7-sonnet-latest']; // Default
    if (classification.type === 'analytical' && classification.complexity === 'very-complex') modelChain = ['claude-3-7-sonnet-latest', 'gpt-4.1'];
    else if (classification.type === 'code' && classification.features.includes('reasoning')) modelChain = ['gpt-4.1', 'claude-3-7-sonnet-latest'];

    const responses: string[] = [];
    const modelsUsed: string[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let currentPrompt = prompt;
    logger.info({ modelChain, prompt: currentPrompt.substring(0, 100) }, 'Executing model chain');

    for (const modelId of modelChain) {
      try {
        const modelResponse = await this.sendToModel(modelId, currentPrompt, maxTokens, temperature);
        responses.push(modelResponse.text);
        modelsUsed.push(modelResponse.model);
        totalPromptTokens += modelResponse.tokens.prompt;
        totalCompletionTokens += modelResponse.tokens.completion;
        currentPrompt = modelResponse.text;
        logger.debug({ modelId, tokens: modelResponse.tokens }, 'Model chain step completed');
      } catch (error) {
        logger.error({ modelId, error }, 'Model chain step failed');
        break;
      }
    }
     const combinedResponse = responses.join('\n\n');
     const routerResponse: RouterResponse = {
       response: combinedResponse, model_used: modelsUsed.join(' -> '),
       tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens, total: totalPromptTokens + totalCompletionTokens },
       model_chain: modelsUsed, processing_time: Date.now() - startTime
     };
     logger.info({ modelsUsed, totalTokens: routerResponse.tokens.total }, 'Model chain execution completed');
     return routerResponse;
  }

  private async executeFallbackStrategy(primaryModel: string, prompt: string, classification: ClassifiedIntent, maxTokens: number, temperature: number, options: RoutingOptions): Promise<FallbackResult> {
    const fallbackLevels = options.fallbackLevels ?? this.defaultOptions.fallbackLevels ?? 2;
    const availableModels = Object.keys(this.models).filter(id => id !== primaryModel && this.isModelAvailable(id));
    availableModels.sort((a, b) => (this.models[b].priority ?? 0) - (this.models[a].priority ?? 0));
    logger.warn({ primaryModel, availableModels, fallbackLevels }, 'Executing fallback strategy');
    let lastError: Error | undefined;

    for (let i = 0; i < fallbackLevels && i < availableModels.length; i++) {
      const fallbackModel = availableModels[i];
      try {
        logger.info({ primaryModel, fallbackModel, attempt: i + 1 }, 'Attempting fallback');
        const response = await this.sendToModel(fallbackModel, prompt, maxTokens, temperature);
        logger.info({ primaryModel, fallbackModel, attempt: i + 1 }, 'Fallback successful');
        this.trackFallback(primaryModel, fallbackModel);
        const routerResponse: RouterResponse = {
          response: response.text, model_used: response.model, tokens: response.tokens, cached: false,
        };
        return { success: true, response: routerResponse };
      } catch (error) {
        logger.error({ primaryModel, fallbackModel, attempt: i + 1, error }, 'Fallback attempt failed');
        lastError = error instanceof Error ? error : new Error(String(error));
        this.trackFallback(primaryModel, fallbackModel, true);
      }
    }
    logger.error({ primaryModel, fallbackLevels, lastError: lastError?.message }, 'All fallback attempts failed');
    return { success: false, error: lastError };
  }

  private trackFallback(primaryModel: string, fallbackModel: string, failed = false): void {
    if (!this.defaultOptions.monitorFallbacks) return;
    const key = `${primaryModel}->${fallbackModel}`;
    const currentAttempts = (this.fallbackAttempts.get(key) ?? 0) + 1;
    this.fallbackAttempts.set(key, currentAttempts);
    const alertThreshold = 3;
    if (currentAttempts >= alertThreshold && !this.fallbackAlerts.has(key)) {
      logger.warn({ primaryModel, fallbackModel, attempts: currentAttempts }, 'Repeated fallback detected');
      this.fallbackAlerts.add(key);
    }
    if (failed) {
      const failedKey = `${key}-failed`;
      const currentFailedAttempts = (this.fallbackAttempts.get(failedKey) ?? 0) + 1;
      this.fallbackAttempts.set(failedKey, currentFailedAttempts);
      const failedAlertThreshold = 2;
      if (currentFailedAttempts >= failedAlertThreshold && !this.fallbackAlerts.has(failedKey)) {
        logger.error({ primaryModel, fallbackModel, failedAttempts: currentFailedAttempts }, 'Repeated failed fallback detected');
        this.fallbackAlerts.add(failedKey);
        if ((this.fastify.config as any).AUTO_DEGRADED_MODE === 'true') this.enableDegradedMode();
      }
    } else {
      const failedKey = `${key}-failed`;
      this.fallbackAttempts.delete(failedKey);
      this.fallbackAlerts.delete(failedKey);
    }
  }

  private enableDegradedMode(): void {
    if (!this.degradedModeEnabled) {
      this.degradedModeEnabled = true;
      logger.warn('Degraded operation mode enabled');
    }
  }

  private createDegradedResponse(prompt: string, classification: ClassifiedIntent, error?: Error): RouterResponse {
    logger.warn({ classification, error: error?.message }, 'Creating degraded response');
    const degradedText = `Service temporarily unavailable. Please try again later. (Error: ${error?.message ?? 'Unknown'})`;
    return {
      response: degradedText, model_used: 'degraded-mode',
      tokens: { prompt: 0, completion: 0, total: 0 }, cached: false,
      classification: { intent: 'degraded', confidence: 1.0 },
      processing_time: 0, cost: 0,
    };
  }

  // The selectModel method has been replaced by the routing engine

  private async sendToModel(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    messages?: ChatMessage[],
    tools?: ToolDefinition[],
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  ): Promise<ChatCompletionResponse> { // Changed return type
    const startTime = Date.now();
    try {
      const adapter = getModelAdapter(this.fastify, modelId);
      const options: ModelRequestOptions = {
        maxTokens, temperature,
        messages: messages ?? [{ role: 'user', content: prompt }],
        ...(tools && { tools }),
        ...(toolChoice && { toolChoice })
      };
      const logPrompt = messages ? messages[messages.length - 1]?.content ?? prompt : prompt;
      const modelResponse = await adapter.generateCompletion(logPrompt, options);
      this.updateModelLatency(modelId, Date.now() - startTime);
      void trackModelUsage(modelId, modelResponse.tokens.total, modelResponse.processingTime ?? 0);
      return modelResponse;
    } catch (error) {
      this.updateModelLatency(modelId, Date.now() - startTime);
      const logPrompt = messages ? messages[messages.length - 1]?.content ?? prompt : prompt;
      logger.error({ modelId, prompt: logPrompt.substring(0, 100), error }, 'Failed to send request to model');
      this.modelAvailability.set(modelId, false);
      if (this.models[modelId]) this.models[modelId].available = false;
      throw errors.router.modelRequestFailed(`Model ${modelId} failed`, { modelId, error });
    }
  }

  private generateCacheKey(content: string, modelId?: string, maxTokens?: number, temperature?: number, tools?: string, toolChoice?: string): string {
    const keyData = `${content}-${modelId ?? 'auto'}-${maxTokens ?? 'default'}-${temperature ?? 'default'}-${tools ?? 'none'}-${toolChoice ?? 'none'}`;
    return crypto.createHash('sha256').update(keyData).digest('hex');
  }

  private determineCacheTTL(classification: ClassifiedIntent, defaultTTL: number): number {
    return classification.complexity === 'simple' ? defaultTTL / 2 : defaultTTL;
  }
}

/**
 * Factory function to create a router service
 * @param fastify The Fastify instance
 * @returns A router service instance
 */
export function createRouterService(fastify: FastifyInstance): RouterServiceInterface {
  return new RouterService(fastify);
}