import { FastifyInstance } from 'fastify';
import createClassifierService, { ClassifiedIntent } from './classifier.js';
import createCacheService from './cache.js';
import crypto from 'crypto';
import { trackModelUsage, startTrace, endTrace } from '../utils/logger.js';
import { performance } from 'perf_hooks';
import { getModelAdapter } from '../models/adapter-registry.js';
import { ModelRequestOptions } from '../models/base-adapter.js';
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
        return await this.executeModelChain(prompt, classification, maxTokens, temperature, routingOptions);
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
   * Select the best model based on the classified intent
   * @param intent The classified intent
   * @returns The selected model ID
   */
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
    options: RoutingOptions
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    
    // Determine chain based on classification
    let modelChain: string[] = [];
    
    if (classification.type === 'analytical' && classification.complexity === 'very-complex') {
      // For complex analytical tasks, use a reasoning model followed by a knowledge model
      modelChain = ['claude-3-7-sonnet-latest', 'gpt-4.1'];
    } else if (classification.type === 'code' && classification.features.includes('reasoning')) {
      // For complex code tasks, use a reasoning model followed by a code-specific model
      modelChain = ['gpt-4', 'claude-3-sonnet'];
    } else if (classification.features.includes('summarization')) {
      // For summarization tasks, use a fast model followed by a quality model
      modelChain = ['gpt-3.5-turbo', 'claude-3-sonnet'];
    } else {
      // Default chain for other complex tasks
      modelChain = ['gpt-3.5-turbo', 'claude-3-opus'];
    }
    
    // Filter out unavailable models
    modelChain = modelChain.filter(model => this.isModelAvailable(model));
    
    // If no models are available, fall back to default selection
    if (modelChain.length === 0) {
      const fallbackModel = this.selectFallbackModel('gpt-4', classification);
      return await this.sendToModel(fallbackModel, prompt, maxTokens, temperature);
    }
    
    // Execute the chain
    let currentPrompt = prompt;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let finalResponse = '';
    
    for (let i = 0; i < modelChain.length; i++) {
      const modelId = modelChain[i];
      const isLastModel = i === modelChain.length - 1;
      
      // Add chain context for intermediate models
      let chainPrompt = currentPrompt;
      if (!isLastModel) {
        chainPrompt = `${currentPrompt}\n\nThis is part of a model chain. Please provide a detailed analysis that will be refined by another model.`;
      }
      
      // Send to current model in chain
      const response = await this.sendToModel(
        modelId,
        chainPrompt,
        isLastModel ? maxTokens : Math.min(maxTokens, 2048), // Limit tokens for intermediate steps
        isLastModel ? temperature : 0.5 // Lower temperature for intermediate steps
      );
      
      // Update token counts
      totalPromptTokens += response.tokens.prompt;
      totalCompletionTokens += response.tokens.completion;
      
      // Update prompt for next model in chain
      if (!isLastModel) {
        currentPrompt = `Original prompt: "${prompt}"\n\nPrevious model analysis: "${response.response}"\n\nPlease refine and improve the above analysis.`;
      }
      
      // Save final response
      finalResponse = response.response;
    }
    
    // Create combined response
    const combinedResponse: RouterResponse = {
      response: finalResponse,
      model_used: modelChain[modelChain.length - 1],
      model_chain: modelChain,
      tokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens
      },
      classification: {
        intent: classification.type,
        confidence: classification.confidence,
        features: classification.features,
        domain: classification.domain
      },
      processing_time: Date.now() - startTime
    };
    
    return combinedResponse;
  }

  /**
   * Determine cache TTL based on classification
   * @param classification Prompt classification
   * @param defaultTTL Default TTL in seconds
   * @returns TTL in seconds
   */
  private determineCacheTTL(classification: ClassifiedIntent, defaultTTL: number): number {
    // Factual and mathematical content can be cached longer
    if (classification.type === 'factual' || classification.type === 'mathematical') {
      return defaultTTL * 2; // Double the TTL
    }
    
    // Conversational content should be cached for less time
    if (classification.type === 'conversational') {
      return Math.floor(defaultTTL / 2); // Half the TTL
    }
    
    // Simple queries can be cached longer
    if (classification.complexity === 'simple') {
      return Math.floor(defaultTTL * 1.5); // 1.5x the TTL
    }
    
    // Complex queries should be cached for less time
    if (classification.complexity === 'very-complex') {
      return Math.floor(defaultTTL / 1.5); // 2/3 the TTL
    }
    
    return defaultTTL;
  }

  /**
   * Select a fallback model when the primary model is unavailable
   * @param primaryModel The unavailable primary model
   * @param classification The prompt classification
   * @returns Fallback model ID
   */
  private selectFallbackModel(primaryModel: string, _classification: ClassifiedIntent): string {
    // Get primary model info
    const primaryModelInfo = this.models[primaryModel];
    
    if (!primaryModelInfo) {
      // If primary model not found, return default fallback
      return 'gpt-3.5-turbo';
    }
    
    // Get available models except the primary
    const availableModels = Object.values(this.models).filter(model =>
      model.id !== primaryModel && this.isModelAvailable(model.id)
    );
    
    if (availableModels.length === 0) {
      // If no models are available, return default (even though it's unavailable)
      return 'gpt-3.5-turbo';
    }
    
    // Find models from the same provider
    const sameProviderModels = availableModels.filter(model =>
      model.provider === primaryModelInfo.provider
    );
    
    if (sameProviderModels.length > 0) {
      // Sort by quality (descending)
      sameProviderModels.sort((a, b) => b.quality - a.quality);
      return sameProviderModels[0].id;
    }
    
    // Find models with similar capabilities
    const similarCapabilityModels = availableModels.filter(model =>
      primaryModelInfo.capabilities.every(capability =>
        model.capabilities.includes(capability)
      )
    );
    
    if (similarCapabilityModels.length > 0) {
      // Sort by quality (descending)
      similarCapabilityModels.sort((a, b) => b.quality - a.quality);
      return similarCapabilityModels[0].id;
    }
    
    // Default to highest quality available model
    availableModels.sort((a, b) => b.quality - a.quality);
    return availableModels[0].id;
  }

  /**
   * Select the best model based on the classified intent and routing options
   * @param classification The classified intent
   * @param options Routing options
   * @returns The selected model ID
   */
  private selectModel(classification: ClassifiedIntent, options?: RoutingOptions): string {
    if (!options) {
      // If no options provided, use simple selection
      // For this proof of concept, we'll use a simple mapping
      const intentModelMap: Record<string, string> = {
        'general': 'gpt-4.1',
        'code': 'gpt-4.1',
        'creative': 'claude-3-7-sonnet-latest',
        'factual': 'gpt-4.1',
        'unknown': 'claude-3-7-sonnet-latest',
        'mathematical': 'gpt-4.1',
        'conversational': 'claude-3-7-sonnet-latest',
        'analytical': 'claude-3-7-sonnet-latest'
      };
      
      // Get the model for this intent, or default to gpt-4.1
      return intentModelMap[classification.type] || 'gpt-4.1';
    }
    
    // Get available models
    const availableModels = Object.values(this.models).filter(model =>
      this.isModelAvailable(model.id)
    );
    
    if (availableModels.length === 0) {
      // If no models are available, return default
      return 'gpt-4.1';
    }
    
    // Filter models that have the required capabilities
    let suitableModels = availableModels.filter(model =>
      classification.features.every(feature => model.capabilities.includes(feature))
    );
    
    // If no models have all required capabilities, get models with most capabilities
    if (suitableModels.length === 0) {
      const maxCapabilities = Math.max(...availableModels.map(model =>
        classification.features.filter(feature =>
          model.capabilities.includes(feature)
        ).length
      ));
      
      suitableModels = availableModels.filter(model =>
        classification.features.filter(feature =>
          model.capabilities.includes(feature)
        ).length === maxCapabilities
      );
    }
    
    // Apply optimization strategies
    if (options.costOptimize) {
      // Sort by cost (ascending)
      suitableModels.sort((a, b) => a.cost - b.cost);
      return suitableModels[0].id;
    } else if (options.latencyOptimize) {
      // Sort by latency (ascending)
      suitableModels.sort((a, b) => a.latency - b.latency);
      return suitableModels[0].id;
    } else if (options.qualityOptimize) {
      // Sort by quality (descending)
      suitableModels.sort((a, b) => b.quality - a.quality);
      return suitableModels[0].id;
    }
    
    // Default selection based on intent type and complexity
    const intentModelMap: Record<string, string> = {
      'general': 'gpt-3.5-turbo',
      'code': 'gpt-4',
      'creative': 'claude-3-opus',
      'analytical': 'claude-3-opus',
      'factual': 'gpt-4',
      'mathematical': 'gpt-3.5-turbo',
      'conversational': 'claude-3-haiku'
    };
    
    // Adjust based on complexity
    if (classification.complexity === 'very-complex' || classification.complexity === 'complex') {
      if (classification.type === 'code' || classification.type === 'analytical') {
        return 'gpt-4';
      } else if (classification.type === 'creative') {
        return 'claude-3-opus';
      }
    } else if (classification.complexity === 'simple') {
      if (classification.type === 'conversational') {
        return 'claude-3-haiku';
      } else {
        return 'gpt-3.5-turbo';
      }
    }
    
    // Get the model for this intent, or default to gpt-3.5-turbo
    const selectedModel = intentModelMap[classification.type] ?? 'gpt-3.5-turbo';
    
    // Check if selected model is available
    if (this.isModelAvailable(selectedModel)) {
      return selectedModel;
    } else {
      // Fall back to any suitable model
      return suitableModels[0]?.id || 'gpt-3.5-turbo';
    }
  }

  /**
   * Generate a cache key for the prompt and parameters
   * @param prompt The user prompt
   * @param modelId The model ID
   * @param maxTokens Maximum tokens to generate
   * @param temperature Sampling temperature
   * @returns The cache key
   */
  private generateCacheKey(
    prompt: string,
    modelId?: string,
    maxTokens = 1024,
    temperature = 0.7
  ): string {
    // Create a hash of the prompt
    const hash = crypto
      .createHash('sha256')
      .update(prompt)
      .digest('hex')
      .substring(0, 16);
    
    // Add model ID, max tokens, and temperature to the key
    const modelPart = modelId ?? 'default';
    
    // Simple cache key generation
    return `${modelPart}:${maxTokens}:${temperature}:${hash}`;
  }

  /**
   * Check if a response is cached
   * @param cacheKey The cache key
   * @returns The cached response or null
   */
  private async checkCache(cacheKey: string) {
    try {
      const cached = await this.fastify.redis.get(cacheKey);
      return cached ? JSON.parse(cached) as RouterResponse : null;
    } catch (error) {
      this.fastify.log.error(error, 'Cache check failed');
      return null;
    }
  }

  /**
   * Cache a response
   * @param cacheKey The cache key
   * @param response The response to cache
   */
  private async cacheResponse(cacheKey: string, response: RouterResponse) {
    try {
      // Cache for 1 hour
      await this.fastify.redis.set(
        cacheKey,
        JSON.stringify(response),
        'EX',
        60 * 60
      );
    } catch (error) {
      this.fastify.log.error(error, 'Cache set failed');
    }
  }

  /**
   * Send a prompt to a specific model
   * @param modelId The model ID
   * @param prompt The user prompt
   * @param maxTokens Maximum tokens to generate
   * @param temperature Sampling temperature
   * @returns The model response
   */
  /**
   * Send a prompt to a model with timeout handling
   * @param modelId Model ID
   * @param prompt User prompt
   * @param maxTokens Maximum tokens
   * @param temperature Temperature
   * @param timeoutMs Optional timeout in milliseconds
   * @returns Router response
   */
  private async sendToModel(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    _timeoutMs?: number // Used in executeFallbackStrategy
  ): Promise<RouterResponse> {
    // Start a trace for this model call
    const traceId = startTrace('model_call', undefined, {
      modelId,
      promptLength: prompt.length,
      maxTokens,
      temperature
    });
    
    const startTime = performance.now();
    
    try {
      // Get the appropriate adapter for this model
      const adapter = getModelAdapter(this.fastify, modelId);
      
      // Prepare request options
      const options: ModelRequestOptions = {
        maxTokens,
        temperature
      };
      
      // Generate completion using the adapter
      const modelResponse = await adapter.generateCompletion(prompt, options);
      
      // Calculate response time
      const responseTime = performance.now() - startTime;
      
      // Track model usage metrics
      trackModelUsage(modelId, modelResponse.tokens.total, responseTime);
      
      // Update model latency tracking
      this.updateModelLatency(modelId, responseTime);
      
      // End the trace
      endTrace(traceId, {
        promptTokens: modelResponse.tokens.prompt,
        completionTokens: modelResponse.tokens.completion,
        totalTokens: modelResponse.tokens.total,
        responseTime,
        success: true
      });
      
      // Log the model call with correlation ID
      this.fastify.log.info({
        modelId,
        promptTokens: modelResponse.tokens.prompt,
        completionTokens: modelResponse.tokens.completion,
        totalTokens: modelResponse.tokens.total,
        responseTime: Math.round(responseTime),
        maxTokens,
        temperature,
      }, 'Model call completed');
      
      // Create and return the response
      const response: RouterResponse = {
        response: modelResponse.text,
        model_used: modelId,
        tokens: {
          prompt: modelResponse.tokens.prompt,
          completion: modelResponse.tokens.completion,
          total: modelResponse.tokens.total,
        },
        classification: {
          intent: 'unknown',
          confidence: 0.5,
        },
        processing_time: responseTime / 1000, // Convert to seconds
      };
      
      return response;
    } catch (error) {
      // End the trace with error
      endTrace(traceId, {
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
      
      // Log the error
      this.fastify.log.error({
        error,
        modelId,
        promptLength: prompt.length,
      }, 'Model call failed');
      
      // Rethrow with additional context
      throw new Error(`Failed to call model ${modelId}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    
    // Get fallback models in priority order
    const fallbackModels = this.getFallbackModelsInOrder(primaryModel, classification);
    
    // Track fallback attempts for monitoring
    if (options.monitorFallbacks ?? this.defaultOptions.monitorFallbacks) {
      const currentAttempts = this.fallbackAttempts.get(primaryModel) ?? 0;
      this.fallbackAttempts.set(primaryModel, currentAttempts + 1);
      
      // Alert if fallbacks are happening too frequently
      if (currentAttempts >= 5 && !this.fallbackAlerts.has(primaryModel)) {
        this.fastify.log.warn({
          modelId: primaryModel,
          fallbackCount: currentAttempts
        }, 'Frequent fallbacks detected for model');
        
        this.fallbackAlerts.add(primaryModel);
      }
    }
    
    // Try each fallback model in order, up to the fallback level limit
    let lastError: Error | undefined;
    
    for (let i = 0; i < Math.min(fallbackModels.length, fallbackLevels); i++) {
      const fallbackModel = fallbackModels[i];
      
      try {
        this.fastify.log.warn({
          originalModel: primaryModel,
          fallbackModel,
          fallbackLevel: i + 1,
          maxLevels: fallbackLevels,
          reason: lastError ? `Previous error: ${lastError.message}` : 'Model unavailable'
        }, 'Using fallback model');
        
        // Send to fallback model with timeout from options
        const response = await this.sendToModel(
          fallbackModel,
          prompt,
          maxTokens,
          temperature,
          options.timeoutMs
        );
        
        // Return successful result
        return {
          success: true,
          response
        };
      } catch (error) {
        // Store error for next iteration
        lastError = error instanceof Error ? error : new Error(String(error));
        
        this.fastify.log.error({
          fallbackModel,
          fallbackLevel: i + 1,
          error: lastError.message
        }, 'Fallback model failed');
      }
    }
    
    // All fallbacks failed
    return {
      success: false,
      error: lastError ?? new Error('All fallback models failed')
    };
  }
  
  /**
   * Get fallback models in priority order
   * @param primaryModel Primary model ID
   * @param classification Prompt classification
   * @returns Array of fallback model IDs in priority order
   */
  private getFallbackModelsInOrder(primaryModel: string, classification: ClassifiedIntent): string[] {
    // Get all available models except the primary
    const availableModels = Object.values(this.models).filter(model =>
      model.id !== primaryModel && this.isModelAvailable(model.id)
    );
    
    if (availableModels.length === 0) {
      return [];
    }
    
    // First priority: same provider models
    const primaryModelInfo = this.models[primaryModel];
    const sameProviderModels = availableModels.filter(model =>
      model.provider === primaryModelInfo?.provider
    );
    
    // Second priority: models with similar capabilities
    const similarCapabilityModels = availableModels.filter(model =>
      primaryModelInfo?.capabilities.every(capability =>
        model.capabilities.includes(capability)
      )
    );
    
    // Third priority: models that match the classification requirements
    const classificationModels = availableModels.filter(model =>
      classification.features.every(feature =>
        model.capabilities.includes(feature)
      )
    );
    
    // Fourth priority: any available model sorted by quality
    const sortedByQuality = [...availableModels].sort((a, b) => b.quality - a.quality);
    
    // Combine all priorities, removing duplicates
    const allModels: string[] = [];
    
    // Add models in priority order, avoiding duplicates
    const addModelsNoDuplicates = (models: ModelInfo[]) => {
      for (const model of models) {
        if (!allModels.includes(model.id)) {
          allModels.push(model.id);
        }
      }
    };
    
    addModelsNoDuplicates(sameProviderModels);
    addModelsNoDuplicates(similarCapabilityModels);
    addModelsNoDuplicates(classificationModels);
    addModelsNoDuplicates(sortedByQuality);
    
    return allModels;
  }
  
  /**
   * Create a degraded response when all models fail
   * @param prompt Original prompt
   * @param classification Prompt classification
   * @param error Error that occurred
   * @returns Degraded response
   */
  private createDegradedResponse(
    prompt: string,
    classification: ClassifiedIntent,
    error?: Error
  ): RouterResponse {
    // Try to get a cached response for similar prompts
    const degradedResponse: RouterResponse = {
      response: 'The service is currently experiencing issues. Please try again later.',
      model_used: 'degraded_mode',
      tokens: {
        prompt: classification.tokens.estimated,
        completion: 20,
        total: classification.tokens.estimated + 20
      },
      classification: {
        intent: classification.type,
        confidence: classification.confidence,
        features: classification.features,
        domain: classification.domain
      },
      processing_time: 0.1,
      cached: false
    };
    
    // Add error details if available
    if (error) {
      degradedResponse.response += ` (Error: ${error.message})`;
    }
    
    this.fastify.log.error({
      mode: 'degraded',
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      error: error?.message
    }, 'Serving degraded response');
    
    return degradedResponse;
  }
}

// Factory function to create a router service
export function createRouterService(fastify: FastifyInstance) {
  return new RouterService(fastify);
}

export default createRouterService;