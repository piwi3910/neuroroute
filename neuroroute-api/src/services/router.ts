import { FastifyInstance } from 'fastify';
import createClassifierService, { ClassifiedIntent } from './classifier.js';
import createCacheService from './cache.js';
import crypto from 'crypto';
import { trackModelUsage } from '../utils/logger.js';
import { getModelAdapter } from '../models/adapter-registry.js';
import { ModelRequestOptions, ChatMessage, ToolDefinition, ModelResponse } from '../models/base-adapter.js';
import { errors } from '../utils/error-handler.js';

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
 * Chat completion response
 */
export interface ChatCompletionResponse extends ModelResponse {
  // Additional fields specific to chat completions
  id?: string;
  created?: number;
  cached?: boolean; // Add cached property
}

/**
 * Model information
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
  // Fallback and degradation options
  fallbackLevels?: number; // Number of fallback attempts (default: 2)
  degradedMode?: boolean; // Enable degraded operation mode
  timeoutMs?: number; // Request timeout in milliseconds
  monitorFallbacks?: boolean; // Monitor and alert on repeated fallbacks
}

/**
 * Fallback result interface
 */
interface FallbackResult {
  success: boolean;
  response?: RouterResponse;
  error?: Error;
}

/**
 * Model router service
 */
export class RouterService {
  private fastify: FastifyInstance;
  private classifier: ReturnType<typeof createClassifierService>;
  private cache: ReturnType<typeof createCacheService>;
  private models: Record<string, ModelInfo>;
  private defaultOptions: RoutingOptions;
  private modelAvailability: Map<string, boolean>;
  private modelLatencies: Map<string, number[]>;
  private fallbackAttempts: Map<string, number>; // Track fallback attempts
  private fallbackAlerts: Set<string>; // Track models that have triggered alerts
  private degradedModeEnabled: boolean; // Global degraded mode flag

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.classifier = createClassifierService(fastify);
    
    // Get config with fallback
    const config = (fastify as unknown as { config?: Record<string, unknown> }).config ?? {};
    const cacheTTL = (config.REDIS_CACHE_TTL as number) ?? 300;
    
    this.cache = createCacheService(fastify, {
      namespace: 'router',
      ttl: cacheTTL,
    });

    // Initialize empty model information
    this.models = {};

    // Initialize model availability tracking
    this.modelAvailability = new Map();
    
    // Load model configurations from database
    void this.loadModelConfigurations();

    // Initialize model latency tracking
    this.modelLatencies = new Map();
    Object.keys(this.models).forEach(modelId => {
      this.modelLatencies.set(modelId, []);
    });

    // Set default routing options
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
    
    // Initialize fallback tracking
    this.fallbackAttempts = new Map();
    this.fallbackAlerts = new Set();
    this.degradedModeEnabled = this.defaultOptions.degradedMode ?? false;

    // Start periodic health checks for models
    this.startModelHealthChecks();
  }

  /**
   * Start periodic health checks for models
   */
  private startModelHealthChecks(): void {
    // Check model availability every 5 minutes
    setInterval(() => {
      void this.checkModelAvailability();
    }, 5 * 60 * 1000);
    
    // Reload model configurations every 15 minutes
    setInterval(() => {
      void this.loadModelConfigurations();
    }, 15 * 60 * 1000);
    
    // Reset fallback tracking every hour
    setInterval(() => {
      this.fallbackAttempts.clear();
      this.fallbackAlerts.clear();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Load model configurations from database
   */
  private async loadModelConfigurations(): Promise<void> {
    try {
      // Get config manager
      const configManager = this.fastify.configManager;
      
      if (configManager) {
        // Try to get model configurations from database
        const modelConfigs = await configManager.getAllModelConfigs();
        
        if (modelConfigs && modelConfigs.length > 0) {
          // Convert to model info format
          const newModels: Record<string, ModelInfo> = {};
          
          for (const config of modelConfigs) {
            if (config.enabled) {
              newModels[config.id] = {
                id: config.id,
                provider: config.provider,
                capabilities: config.capabilities,
                cost: config.config.cost ?? 0,
                quality: config.config.quality ?? 0.5,
                maxTokens: config.config.maxTokens ?? 4096,
                available: true, // Will be checked by checkModelAvailability
                latency: config.config.latency ?? 2000,
                priority: config.priority
              };
            }
          }
          
          // If we have models, replace the current models
          if (Object.keys(newModels).length > 0) {
            // Preserve availability status from existing models
            for (const modelId of Object.keys(newModels)) {
              if (this.models[modelId]) {
                newModels[modelId].available = this.models[modelId].available;
                
                // Preserve latency measurements
                const latencies = this.modelLatencies.get(modelId);
                if (latencies && latencies.length > 0) {
                  newModels[modelId].latency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
                }
              }
            }
            
            this.models = newModels;
            
            // Initialize latency tracking for new models
            for (const modelId of Object.keys(this.models)) {
              if (!this.modelLatencies.has(modelId)) {
                this.modelLatencies.set(modelId, []);
              }
            }
            
            this.fastify.log.info({
              modelCount: Object.keys(this.models).length
            }, 'Loaded model configurations from database');
            
            // Check availability of models
            void this.checkModelAvailability();
            return;
          }
        }
      }
      
      // If no models in database or config manager not available, use default models
      if (Object.keys(this.models).length === 0) {
        this.loadDefaultModels();
        this.fastify.log.warn('Using default model configurations');
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to load model configurations from database');
      
      // If no models loaded yet, use default models
      if (Object.keys(this.models).length === 0) {
        this.loadDefaultModels();
        this.fastify.log.warn('Using default model configurations due to error');
      }
    }
  }
  
  /**
   * Load default model configurations
   */
  private loadDefaultModels(): void {
    // Default model information
    this.models = {
      'gpt-4.1': {
        id: 'gpt-4.1',
        provider: 'openai',
        capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'],
        cost: 0.03,
        quality: 0.95,
        maxTokens: 8192,
        available: true,
        latency: 2000,
        priority: 3
      },
      'claude-3-7-sonnet-latest': {
        id: 'claude-3-7-sonnet-latest',
        provider: 'anthropic',
        capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'],
        cost: 0.025,
        quality: 0.95,
        maxTokens: 200000,
        available: true,
        latency: 2000,
        priority: 3
      },
      'lmstudio-local': {
        id: 'lmstudio-local',
        provider: 'local',
        capabilities: ['text-generation', 'code-generation'],
        cost: 0.0,
        quality: 0.75,
        maxTokens: 4096,
        available: true,
        latency: 3000,
        priority: 0
      }
    };
    
    // Initialize model availability tracking
    this.modelAvailability = new Map();
    
    // Initialize model latency tracking
    this.modelLatencies = new Map();
    Object.keys(this.models).forEach(modelId => {
      this.modelLatencies.set(modelId, []);
    });
  }

  /**
   * Check availability of all models
   */
  private async checkModelAvailability(): Promise<void> {
    for (const modelId of Object.keys(this.models)) {
      try {
        // Get the appropriate adapter for this model
        const adapter = getModelAdapter(this.fastify, modelId);
        
        // Check if the model is available using the adapter
        const isAvailable = await adapter.isAvailable();
        
        // Update availability
        this.modelAvailability.set(modelId, isAvailable);
        this.models[modelId].available = isAvailable;
        
        this.fastify.log.debug({
          modelId,
          available: isAvailable
        }, 'Model availability check');
      } catch (error) {
        this.fastify.log.error({
          modelId,
          error
        }, 'Model availability check failed');
        
        // Mark as unavailable on error
        this.modelAvailability.set(modelId, false);
        this.models[modelId].available = false;
      }
    }
  }

  /**
   * Update model latency tracking
   * @param modelId Model ID
   * @param latency Latency in milliseconds
   */
  private updateModelLatency(modelId: string, latency: number): void {
    const latencies = this.modelLatencies.get(modelId) ?? [];
    
    // Keep only the last 10 latency measurements
    if (latencies.length >= 10) {
      latencies.shift();
    }
    
    latencies.push(latency);
    this.modelLatencies.set(modelId, latencies);
    
    // Update average latency in model info
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    if (this.models[modelId]) {
      this.models[modelId].latency = avgLatency;
    }
  }

  /**
   * Route a prompt to the appropriate model
   *
   * @param prompt The user prompt
   * @param modelId Optional specific model ID to use
   * @param maxTokens Maximum tokens to generate
   * @param temperature Sampling temperature
   * @returns The model response
   */
  async routePrompt(
    prompt: string,
    modelId?: string,
    maxTokens = 1024,
    temperature = 0.7,
    options?: RoutingOptions
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    
    try {
      // Merge provided options with defaults
      const routingOptions = {
        ...this.defaultOptions,
        ...options
      };
      
      // Generate a cache key for this prompt
      const cacheKey = this.generateCacheKey(prompt, modelId, maxTokens, temperature);
      
      // Check if caching is enabled based on strategy
      if (routingOptions.cacheStrategy !== 'none') {
        // Determine if we should check cache based on strategy
        let shouldCheckCache = true;
        
        if (routingOptions.cacheStrategy === 'minimal' && prompt.length < 50) {
          // Only cache very short prompts in minimal mode
          shouldCheckCache = false;
        }
        
        if (shouldCheckCache) {
          // Try to get from cache
          const cachedResponse = await this.cache.get<RouterResponse>(cacheKey);
          if (cachedResponse) {
            this.fastify.log.info({
              cacheKey,
              modelId: cachedResponse.model_used,
              strategy: routingOptions.cacheStrategy
            }, 'Cache hit for prompt');
            
            return {
              ...cachedResponse,
              cached: true,
            };
          }
        }
      }
      
      // Classify the prompt for advanced routing
      const classification = await this.classifier.classifyPrompt(prompt);
      
      // If a specific model is requested and it's available, use it
      if (modelId && this.isModelAvailable(modelId)) {
        const response = await this.sendToModel(modelId, prompt, maxTokens, temperature);
        
        // Add classification to response
        response.classification = {
          intent: classification.type,
          confidence: classification.confidence,
          features: classification.features,
          domain: classification.domain
        };
        
        // Add processing time
        response.processing_time = Date.now() - startTime;
        
        // Cache the response if enabled
        if (routingOptions.cacheStrategy !== 'none') {
          const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
          await this.cache.set(cacheKey, response, ttl);
        }
        
        return response;
      }
      
      // If model chaining is enabled and appropriate for this prompt
      if (routingOptions.chainEnabled && this.shouldUseModelChain(classification)) {
        return await this.executeModelChain(prompt, classification, maxTokens, temperature);
      }
      
      // Select the best model based on classification and options
      const selectedModel = this.selectModel(classification, routingOptions);
      
      // Add classification info to log
      this.fastify.log.debug({
        classification,
        selectedModel,
        routingOptions
      }, 'Prompt classified and model selected');

      // Check if selected model is available
      if (!this.isModelAvailable(selectedModel) && routingOptions.fallbackEnabled) {
        // Find fallback model with multi-level strategy
        const fallbackResult = await this.executeFallbackStrategy(
          selectedModel,
          prompt,
          classification,
          maxTokens,
          temperature,
          routingOptions
        );
        
        // If fallback was successful, return the response
        if (fallbackResult.success && fallbackResult.response) {
          const fallbackResponse = fallbackResult.response;
          
          // Add classification and processing info
          fallbackResponse.classification = {
            intent: classification.type,
            confidence: classification.confidence,
            features: classification.features,
            domain: classification.domain
          };
          fallbackResponse.processing_time = Date.now() - startTime;
          
          // Cache the response if enabled
          if (routingOptions.cacheStrategy !== 'none') {
            const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
            await this.cache.set(cacheKey, fallbackResponse, ttl);
          }
          
          return fallbackResponse;
        }
        
        // If all fallbacks failed and we're in degraded mode, return a degraded response
        if (this.degradedModeEnabled || routingOptions.degradedMode) {
          return this.createDegradedResponse(prompt, classification, fallbackResult.error);
        }
        
        // If all fallbacks failed and we're not in degraded mode, throw an error
        throw errors.router.allModelsFailed(
          'All models failed to process the request',
          {
            originalModel: selectedModel,
            classification: classification.type,
            error: fallbackResult.error?.message
          }
        );
      }
      
      // Send to selected model
      const response = await this.sendToModel(selectedModel, prompt, maxTokens, temperature);
      
      // Add classification and processing info
      response.classification = {
        intent: classification.type,
        confidence: classification.confidence,
        features: classification.features,
        domain: classification.domain
      };
      response.processing_time = Date.now() - startTime;
      
      // Calculate cost
      if (this.models[selectedModel]) {
        const costPerToken = this.models[selectedModel].cost / 1000; // Cost per 1000 tokens
        response.cost = (response.tokens.total * costPerToken);
      }
      
      // Cache the response if enabled
      if (routingOptions.cacheStrategy !== 'none') {
        const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
        await this.cache.set(cacheKey, response, ttl);
      }

      return response;
    } catch (error) {
      // Log error with context
      this.fastify.log.error({
        error,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        modelId,
      }, 'Failed to route prompt');
      
      // Rethrow with better message
      if (error instanceof Error) {
        throw new Error(`Failed to route prompt: ${error.message}`);
      } else {
        throw new Error(`Failed to route prompt: ${String(error)}`);
      }
    }
  }

  /**
   * Route a chat completion request to the appropriate model
   *
   * @param messages Array of chat messages
   * @param modelId Optional specific model ID to use
   * @param maxTokens Maximum tokens to generate
   * @param temperature Sampling temperature
   * @param tools Optional array of tool definitions
   * @param toolChoice How to use tools ('auto', 'none', or specific tool)
   * @param options Routing options
   * @returns The chat completion response
   */
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
      // Extract the user's prompt from the messages array
      // We'll use the last user message as the prompt for classification and routing
      let userPrompt = '';
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user' && messages[i].content) {
          userPrompt = messages[i].content!;
          break;
        }
      }
      
      if (!userPrompt) {
        throw errors.router.invalidRequest(
          'No user message found in the messages array',
          { messageCount: messages.length }
        );
      }
      
      // Merge provided options with defaults
      const routingOptions = {
        ...this.defaultOptions,
        ...options
      };
      
      // Generate a cache key for this chat completion
      const messagesJson = JSON.stringify(messages);
      const cacheKey = this.generateCacheKey(
        messagesJson, 
        modelId, 
        maxTokens, 
        temperature,
        tools ? JSON.stringify(tools) : undefined,
        toolChoice ? JSON.stringify(toolChoice) : undefined
      );
      
      // Check if caching is enabled based on strategy
      if (routingOptions.cacheStrategy !== 'none') {
        // Determine if we should check cache based on strategy
        let shouldCheckCache = true;
        
        if (routingOptions.cacheStrategy === 'minimal' && userPrompt.length < 50) {
          // Only cache very short prompts in minimal mode
          shouldCheckCache = false;
        }
        
        if (shouldCheckCache) {
          // Try to get from cache
          const cachedResponse = await this.cache.get<ChatCompletionResponse>(cacheKey);
          if (cachedResponse) {
            this.fastify.log.info({
              cacheKey,
              modelId: cachedResponse.model,
              strategy: routingOptions.cacheStrategy
            }, 'Cache hit for chat completion');
            
            return {
              ...cachedResponse,
              cached: true,
            };
          }
        }
      }
      
      // Classify the prompt for advanced routing
      const classification = await this.classifier.classifyPrompt(userPrompt);
      
      // If a specific model is requested and it's available, use it
      if (modelId && this.isModelAvailable(modelId)) {
        // Get the appropriate adapter for this model
        const adapter = getModelAdapter(this.fastify, modelId);
        
        // Prepare request options
        const options: ModelRequestOptions = {
          maxTokens,
          temperature,
          messages, // Pass the full messages array
          ...(tools ? { tools } : {}),
          ...(toolChoice ? { toolChoice } : {})
        };
        
        // Generate completion using the adapter
        const modelResponse = await adapter.generateCompletion(userPrompt, options);
        
        // Create chat completion response
        const chatResponse: ChatCompletionResponse = {
          ...modelResponse,
          id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
          created: Math.floor(Date.now() / 1000)
        };
        
        // Add processing time
        chatResponse.processingTime = Date.now() - startTime;
        
        // Cache the response if enabled
        if (routingOptions.cacheStrategy !== 'none') {
          const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
          await this.cache.set(cacheKey, chatResponse, ttl);
        }
        
        return chatResponse;
      }
      
      // If model chaining is enabled and appropriate for this prompt
      if (routingOptions.chainEnabled && this.shouldUseModelChain(classification)) {
        // For chat completions, we don't support model chaining yet
        // This could be implemented in the future
        this.fastify.log.warn({
          classification,
          messageCount: messages.length
        }, 'Model chaining not supported for chat completions yet');
      }
      
      // Select the best model based on classification and options
      const selectedModel = this.selectModel(classification, routingOptions);
      
      // Check if selected model is available
      if (!this.isModelAvailable(selectedModel) && routingOptions.fallbackEnabled) {
        // Find fallback model with multi-level strategy
        const fallbackResult = await this.executeFallbackStrategy(
          selectedModel,
          userPrompt,
          classification,
          maxTokens,
          temperature,
          routingOptions
        );
        
        // If fallback was successful, return the response
        if (fallbackResult.success && fallbackResult.response) {
          // We need to convert the RouterResponse to a ChatCompletionResponse
          // This is a simplified conversion - in a real implementation, you'd want to
          // properly handle all the fields
          const chatResponse: ChatCompletionResponse = {
            text: fallbackResult.response.response,
            tokens: fallbackResult.response.tokens,
            model: fallbackResult.response.model_used,
            processingTime: fallbackResult.response.processing_time ?? 0,
            id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
            created: Math.floor(Date.now() / 1000),
            messages: [...messages, { role: 'assistant', content: fallbackResult.response.response }]
          };
          
          // Cache the response if enabled
          if (routingOptions.cacheStrategy !== 'none') {
            const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
            await this.cache.set(cacheKey, chatResponse, ttl);
          }
          
          return chatResponse;
        }
        
        // If all fallbacks failed and we're in degraded mode, return a degraded response
        if (this.degradedModeEnabled || routingOptions.degradedMode) {
          const degradedResponse = this.createDegradedResponse(userPrompt, classification, fallbackResult.error);
          
          // Convert to chat completion response
          const chatResponse: ChatCompletionResponse = {
            text: degradedResponse.response,
            tokens: degradedResponse.tokens,
            model: degradedResponse.model_used,
            processingTime: degradedResponse.processing_time ?? 0,
            id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
            created: Math.floor(Date.now() / 1000),
            messages: [...messages, { role: 'assistant', content: degradedResponse.response }]
          };
          
          return chatResponse;
        }
        
        // If all fallbacks failed and we're not in degraded mode, throw an error
        throw errors.router.allModelsFailed(
          'All models failed to process the chat completion request',
          {
            originalModel: selectedModel,
            classification: classification.type,
            error: fallbackResult.error?.message
          }
        );
      }
      
      // Get the appropriate adapter for the selected model
      const adapter = getModelAdapter(this.fastify, selectedModel);
      
      // Prepare request options
      const adapterOptions: ModelRequestOptions = {
        maxTokens,
        temperature,
        messages, // Pass the full messages array
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { toolChoice } : {})
      };
      
      // Generate completion using the adapter
      const modelResponse = await adapter.generateCompletion(userPrompt, adapterOptions);
      
      // Create chat completion response
      const chatResponse: ChatCompletionResponse = {
        ...modelResponse,
        id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
        created: Math.floor(Date.now() / 1000)
      };
      
      // Add processing time
      chatResponse.processingTime = Date.now() - startTime;
      
      // Cache the response if enabled
      if (routingOptions.cacheStrategy !== 'none') {
        const ttl = this.determineCacheTTL(classification, routingOptions.cacheTTL ?? 300);
        await this.cache.set(cacheKey, chatResponse, ttl);
      }
      
      return chatResponse;
    } catch (error) {
      // Log error with context
      this.fastify.log.error({
        error,
        messageCount: messages.length,
        modelId,
      }, 'Failed to route chat completion');
      
      // Rethrow with better message
      if (error instanceof Error) {
        throw new Error(`Failed to route chat completion: ${error.message}`);
      } else {
        throw new Error(`Failed to route chat completion: ${String(error)}`);
      }
    }
  }

  /**
   * Classify the prompt to determine intent
   * @param prompt The user prompt
   * @returns The classified intent
   */
  private classifyPrompt(prompt: string): ClassifiedIntent {
    // In a real implementation, this would use a classifier service
    // For this proof of concept, we'll just return a simple classification
    return {
      type: 'general',
      complexity: 'medium',
      features: ['text-generation'],
      priority: 'medium',
      confidence: 0.7,
      tokens: {
        estimated: Math.ceil(prompt.length / 4),
        completion: Math.ceil(prompt.length / 4)
      }
    };
  }

  /**
   * Determine if a model is currently available
   * @param modelId Model ID
   * @returns True if the model is available
   */
  private isModelAvailable(modelId: string): boolean {
    return this.modelAvailability.get(modelId) ?? false;
  }

  /**
   * Determine if model chaining should be used for this prompt
   * @param classification Prompt classification
   * @returns True if model chaining should be used
   */
  private shouldUseModelChain(classification: ClassifiedIntent): boolean {
    // Use model chaining for complex analytical tasks or when multiple features are needed
    return (
      (classification.complexity === 'complex' || classification.complexity === 'very-complex') &&
      (classification.type === 'analytical' || classification.features.length >= 3)
    );
  }

  /**
   * Execute a chain of models for complex tasks
   * @param prompt User prompt
   * @param classification Prompt classification
   * @param maxTokens Maximum tokens
   * @param temperature Temperature
   * @param options Routing options
   * @returns Combined response from model chain
   */
  private async executeModelChain(
    prompt: string,
    classification: ClassifiedIntent,
    maxTokens: number,
    temperature: number,
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    
    // Determine chain based on classification
    let modelChain: string[] = [];
    
    if (classification.type === 'analytical' && classification.complexity === 'very-complex') {
      // For complex analytical tasks, use a reasoning model followed by a knowledge model
      modelChain = ['claude-3-7-sonnet-latest', 'gpt-4.1'];
    } else if (classification.type === 'code' && classification.features.includes('reasoning')) {
      // For complex code tasks, use a reasoning model followed by a code-specific model
      modelChain = ['gpt-4.1', 'claude-3-7-sonnet-latest'];
    } else {
      // Default chain for other complex tasks
      modelChain = ['gpt-4.1', 'claude-3-7-sonnet-latest'];
    }
    
    const responses: string[] = [];
    const modelsUsed: string[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    
    this.fastify.log.info({
      modelChain,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
    }, 'Executing model chain');

    for (const modelId of modelChain) {
      try {
        // Get the appropriate adapter for this model
        const adapter = getModelAdapter(this.fastify, modelId);
        
        // Prepare request options
        const adapterOptions: ModelRequestOptions = {
          maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }], // Pass the current prompt
        };
        
        // Generate completion using the adapter
        const modelResponse = await adapter.generateCompletion(prompt, adapterOptions);
        
        responses.push(modelResponse.text);
        modelsUsed.push(modelResponse.model);
        totalPromptTokens += modelResponse.tokens.prompt;
        totalCompletionTokens += modelResponse.tokens.completion;
        
        // Use the response from the current model as the prompt for the next model
        prompt = modelResponse.text;
        
        this.fastify.log.debug({
          modelId,
          tokens: modelResponse.tokens,
          responseLength: modelResponse.text.length
        }, 'Model chain step completed');
      } catch (error) {
        this.fastify.log.error({
          modelId,
          error
        }, 'Model chain step failed');
        
        // If a step fails, stop the chain and return the partial response
        break;
      }
    }
    
    const combinedResponse = responses.join('\n\n');
    
    const routerResponse: RouterResponse = {
      response: combinedResponse,
      model_used: modelsUsed.join(' -> '),
      tokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens
      },
      model_chain: modelsUsed,
      processing_time: Date.now() - startTime
    };
    
    this.fastify.log.info({
      modelsUsed,
      totalTokens: routerResponse.tokens.total,
      processingTime: routerResponse.processing_time
    }, 'Model chain execution completed');

    return routerResponse;
  }

  /**
   * Execute multi-level fallback strategy
   * @param primaryModel Primary model ID
   * @param prompt User prompt
   * @param classification Prompt classification
   * @param maxTokens Maximum tokens
   * @param temperature Temperature
   * @param options Routing options
   * @returns Fallback result
   */
  private async executeFallbackStrategy(
    primaryModel: string,
    prompt: string,
    classification: ClassifiedIntent,
    maxTokens: number,
    temperature: number,
    options: RoutingOptions
  ): Promise<FallbackResult> {
    // Determine fallback levels
    const fallbackLevels = options.fallbackLevels ?? this.defaultOptions.fallbackLevels ?? 2;
    
    // Get available models, excluding the primary model
    const availableModels = Object.keys(this.models).filter(
      modelId => modelId !== primaryModel && this.isModelAvailable(modelId)
    );
    
    // Sort available models by priority (higher priority first)
    availableModels.sort((a, b) => (this.models[b].priority ?? 0) - (this.models[a].priority ?? 0));
    
    this.fastify.log.warn({
      primaryModel,
      availableModels,
      fallbackLevels,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
    }, 'Executing fallback strategy');

    let lastError: Error | undefined;

    for (let i = 0; i < fallbackLevels && i < availableModels.length; i++) {
      const fallbackModel = availableModels[i];
      
      try {
        this.fastify.log.info({
          primaryModel,
          fallbackModel,
          attempt: i + 1,
          totalAttempts: fallbackLevels
        }, 'Attempting fallback to model');
        
        // Send to fallback model
        const response = await this.sendToModel(fallbackModel, prompt, maxTokens, temperature);
        
        // If successful, return the response
        this.fastify.log.info({
          primaryModel,
          fallbackModel,
          attempt: i + 1
        }, 'Fallback successful');
        
        // Track successful fallback
        this.trackFallback(primaryModel, fallbackModel);
        
        return { success: true, response };
      } catch (error) {
        this.fastify.log.error({
          primaryModel,
          fallbackModel,
          attempt: i + 1,
          error
        }, 'Fallback attempt failed');
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Track failed fallback
        this.trackFallback(primaryModel, fallbackModel, true);
      }
    }
    
    // If all fallbacks failed
    this.fastify.log.error({
      primaryModel,
      fallbackLevels,
      lastError: lastError?.message
    }, 'All fallback attempts failed');

    return { success: false, error: lastError };
  }
  
  /**
   * Track fallback events and trigger alerts if necessary
   * @param primaryModel Primary model that failed
   * @param fallbackModel Fallback model used
   * @param failed Whether the fallback also failed
   */
  private trackFallback(primaryModel: string, fallbackModel: string, failed = false): void {
    if (!this.defaultOptions.monitorFallbacks) {
      return;
    }
    
    const key = `${primaryModel}->${fallbackModel}`;
    const currentAttempts = (this.fallbackAttempts.get(key) ?? 0) + 1;
    this.fallbackAttempts.set(key, currentAttempts);
    
    // Define alert threshold (e.g., 3 fallbacks in an hour)
    const alertThreshold = 3;
    
    if (currentAttempts >= alertThreshold && !this.fallbackAlerts.has(key)) {
      this.fastify.log.warn({
        primaryModel,
        fallbackModel,
        attempts: currentAttempts
      }, 'Repeated fallback detected. Consider investigating primary model.');
      
      // Mark as alerted to avoid repeated alerts for the same pair
      this.fallbackAlerts.add(key);
    }
    
    if (failed) {
      const failedKey = `${key}-failed`;
      const currentFailedAttempts = (this.fallbackAttempts.get(failedKey) ?? 0) + 1;
      this.fallbackAttempts.set(failedKey, currentFailedAttempts);
      
      // Define failed alert threshold (e.g., 2 consecutive failed fallbacks)
      const failedAlertThreshold = 2;
      
      if (currentFailedAttempts >= failedAlertThreshold && !this.fallbackAlerts.has(failedKey)) {
        this.fastify.log.error({
          primaryModel,
          fallbackModel,
          failedAttempts: currentFailedAttempts
        }, 'Repeated failed fallback detected. Consider degraded mode or manual intervention.');
        
        // Mark as alerted
        this.fallbackAlerts.add(failedKey);
        
        // Consider enabling degraded mode automatically if configured
        if (this.fastify.config.AUTO_DEGRADED_MODE === 'true') {
          this.enableDegradedMode();
        }
      }
    } else {
      // Reset failed attempts for this pair on success
      const failedKey = `${key}-failed`;
      this.fallbackAttempts.delete(failedKey);
      this.fallbackAlerts.delete(failedKey);
    }
  }
  
  /**
   * Enable degraded operation mode
   */
  private enableDegradedMode(): void {
    if (!this.degradedModeEnabled) {
      this.degradedModeEnabled = true;
      this.fastify.log.warn('Degraded operation mode enabled due to repeated failed fallbacks.');
      // Potentially send an alert (e.g., email, Slack)
    }
  }

  /**
   * Create a degraded response when all models fail
   * @param prompt User prompt
   * @param classification Prompt classification
   * @param error The error that caused the failure
   * @returns Degraded response
   */
  private createDegradedResponse(
    prompt: string,
    classification: ClassifiedIntent,
    error?: Error
  ): RouterResponse {
    this.fastify.log.warn({
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      classification,
      error: error?.message
    }, 'Creating degraded response');

    const degradedText = `I am currently experiencing technical difficulties and cannot process your request fully. Please try again later. (Error: ${error?.message ?? 'Unknown error'})`;

    return {
      response: degradedText,
      model_used: 'degraded-mode',
      tokens: {
        prompt: classification.tokens.estimated,
        completion: Math.ceil(degradedText.length / 4),
        total: classification.tokens.estimated + Math.ceil(degradedText.length / 4)
      },
      cached: false,
      classification: {
        intent: 'degraded',
        confidence: 1.0,
        features: [],
        domain: 'system'
      },
      processing_time: 0,
      cost: 0,
      model_chain: ['degraded-mode']
    };
  }

  /**
   * Select the best model based on classification and routing options
   * @param classification Prompt classification
   * @param options Routing options
   * @returns The ID of the selected model
   */
  private selectModel(classification: ClassifiedIntent, options: RoutingOptions): string {
    // Filter available models based on capabilities
    const capableModels = Object.values(this.models).filter(model =>
      model.available && classification.features.every(feature => model.capabilities.includes(feature))
    );

    if (capableModels.length === 0) {
      this.fastify.log.error({
        classification,
        options
      }, 'No capable models found for classification');
      throw errors.router.noCapableModels('No models found that can handle the required capabilities', { classification });
    }

    // Sort models based on routing options
    capableModels.sort((a, b) => {
      if (options.qualityOptimize) {
        // Prioritize quality, then priority, then cost
        if (b.quality !== a.quality) return b.quality - a.quality;
        if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
        return a.cost - b.cost;
      } else if (options.costOptimize) {
        // Prioritize cost, then priority, then quality
        if (a.cost !== b.cost) return a.cost - b.cost;
        if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
        return b.quality - a.quality;
      } else if (options.latencyOptimize) {
        // Prioritize latency, then priority, then quality
        if (a.latency !== b.latency) return a.latency - b.latency;
        if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
        return b.quality - a.quality;
      } else {
        // Default: prioritize priority, then quality, then cost
        if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
        if (b.quality !== a.quality) return b.quality - a.quality;
        return a.cost - b.cost;
      }
    });

    // Return the ID of the top model
    const selectedModelId = capableModels[0].id;
    this.fastify.log.debug({
      classification,
      options,
      capableModels: capableModels.map(m => ({ id: m.id, quality: m.quality, cost: m.cost, latency: m.latency, priority: m.priority })),
      selectedModel: selectedModelId
    }, 'Model selection complete');

    return selectedModelId;
  }

  /**
   * Send the prompt to the selected model adapter
   * @param modelId Model ID
   * @param prompt User prompt
   * @param maxTokens Maximum tokens
   * @param temperature Temperature
   * @returns Model response
   */
  private async sendToModel(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    
    try {
      // Get the appropriate adapter for this model
      const adapter = getModelAdapter(this.fastify, modelId);
      
      // Prepare request options
      const options: ModelRequestOptions = {
        maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }], // Pass the prompt as a message
      };
      
      // Generate completion using the adapter
      const modelResponse = await adapter.generateCompletion(prompt, options);
      
      // Update model latency
      this.updateModelLatency(modelId, Date.now() - startTime);
      
      // Track model usage
      void trackModelUsage(modelId, modelResponse.tokens.total, modelResponse.processingTime ?? 0);
      
      return {
        response: modelResponse.text,
        model_used: modelResponse.model,
        tokens: modelResponse.tokens,
        cached: false,
        functionCall: modelResponse.functionCall,
        toolCalls: modelResponse.toolCalls,
        messages: modelResponse.messages
      };
    } catch (error) {
      // Update model latency on failure (can indicate high latency or timeout)
      this.updateModelLatency(modelId, Date.now() - startTime);
      
      this.fastify.log.error({
        modelId,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        error
      }, 'Failed to send prompt to model');
      
      // Mark model as unavailable if it consistently fails
      // This could be implemented with a more sophisticated failure tracking mechanism
      this.modelAvailability.set(modelId, false);
      if (this.models[modelId]) {
        this.models[modelId].available = false;
      }
      
      throw errors.router.modelRequestFailed(`Model ${modelId} failed to process the request`, { modelId, error });
    }
  }

  /**
   * Generate a unique cache key for a prompt and options
   * @param prompt The user prompt
   * @param modelId Optional specific model ID
   * @param maxTokens Maximum tokens
   * @param temperature Temperature
   * @param tools Optional tools JSON string
   * @param toolChoice Optional tool choice JSON string
   * @returns Cache key
   */
  private generateCacheKey(
    prompt: string,
    modelId?: string,
    maxTokens?: number,
    temperature?: number,
    tools?: string,
    toolChoice?: string
  ): string {
    const keyData = `${prompt}-${modelId ?? 'auto'}-${maxTokens ?? 'default'}-${temperature ?? 'default'}-${tools ?? 'none'}-${toolChoice ?? 'none'}`;
    return crypto.createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Determine the cache TTL based on classification
   * @param classification Prompt classification
   * @param defaultTTL Default TTL in seconds
   * @returns Cache TTL in seconds
   */
  private determineCacheTTL(classification: ClassifiedIntent, defaultTTL: number): number {
    // Adjust TTL based on prompt type or complexity
    if (classification.complexity === 'simple') {
      return defaultTTL / 2; // Cache simple prompts shorter
    }
    return defaultTTL;
  }
}

// Factory function to create a router service
export function createRouterService(fastify: FastifyInstance) {
  return new RouterService(fastify);
}
