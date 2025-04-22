import { FastifyInstance } from 'fastify';
import createClassifierService, { ClassifiedIntent } from './classifier';
import createCacheService from './cache';
import crypto from 'crypto';

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
  };
}

/**
 * Model router service
 */
export class RouterService {
  private fastify: FastifyInstance;
  private classifier: ReturnType<typeof createClassifierService>;
  private cache: ReturnType<typeof createCacheService>;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.classifier = createClassifierService(fastify);
    // Get config with fallback
    const config = (fastify as any).config || {};
    const cacheTTL = config.REDIS_CACHE_TTL || 300;
    
    this.cache = createCacheService(fastify, {
      namespace: 'router',
      ttl: cacheTTL,
    });
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
    maxTokens: number = 1024,
    temperature: number = 0.7
  ): Promise<RouterResponse> {
    try {
      // Generate a cache key for this prompt
      const cacheKey = this.generateCacheKey(prompt, modelId, maxTokens, temperature);
      
      // Check if caching is enabled in config (with fallback)
      const configCache = (this.fastify as any).config || {};
      if (configCache.ENABLE_CACHE !== false) {
        // Try to get from cache
        const cachedResponse = await this.cache.get<RouterResponse>(cacheKey);
        if (cachedResponse) {
          this.fastify.log.info({
            cacheKey,
            modelId: cachedResponse.model_used
          }, 'Cache hit for prompt');
          
          return {
            ...cachedResponse,
            cached: true,
          };
        }
      }
      
      // If a specific model is requested, use it
      if (modelId) {
        const response = await this.sendToModel(modelId, prompt, maxTokens, temperature);
        
        // Cache the response if enabled
        const configCache1 = (this.fastify as any).config || {};
        if (configCache1.ENABLE_CACHE !== false) {
          await this.cache.set(cacheKey, response);
        }
        
        return response;
      }

      // Otherwise, classify the prompt and select the best model
      const classification = await this.classifier.classifyPrompt(prompt);
      const selectedModel = this.selectModel(classification);
      
      // Add classification info to log
      this.fastify.log.debug({
        classification,
        selectedModel,
      }, 'Prompt classified and model selected');

      // Send to selected model
      const response = await this.sendToModel(selectedModel, prompt, maxTokens, temperature);
      
      // Add classification to response
      response.classification = {
        intent: classification.type,
        confidence: 0.9, // Default confidence value
      };
      
      // Cache the response if enabled
      const configCache2 = (this.fastify as any).config || {};
      if (configCache2.ENABLE_CACHE !== false) {
        await this.cache.set(cacheKey, response);
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
  private async classifyPrompt(prompt: string): Promise<ClassifiedIntent> {
    // In a real implementation, this would use a classifier service
    // For this proof of concept, we'll just return a simple classification
    return {
      type: 'general',
      complexity: 'medium',
      features: ['text-generation'],
    };
  }

  /**
   * Select the best model based on the classified intent
   * @param intent The classified intent
   * @returns The selected model ID
   */
  private selectModel(classification: ClassifiedIntent): string {
    // Get available models
    const models = {
      'gpt-4': {
        capabilities: ['text-generation', 'code-generation', 'reasoning'],
        cost: 0.03,
        quality: 0.95,
      },
      'claude-3-opus': {
        capabilities: ['text-generation', 'code-generation', 'reasoning'],
        cost: 0.025,
        quality: 0.9,
      },
    };
    
    // In a real implementation, this would use the classification to select
    // the most appropriate model based on capabilities, cost, etc.
    
    // For this proof of concept, we'll use a simple mapping
    const intentModelMap: Record<string, string> = {
      'general': 'gpt-4',
      'code': 'gpt-4',
      'creative': 'claude-3-opus',
      'factual': 'gpt-4',
      'unknown': 'claude-3-opus',
    };
    
    // Get the model for this intent, or default to gpt-4
    return intentModelMap[classification.type] || 'gpt-4';
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
    maxTokens: number = 1024,
    temperature: number = 0.7
  ): string {
    // Create a hash of the prompt
    const hash = crypto
      .createHash('sha256')
      .update(prompt)
      .digest('hex')
      .substring(0, 16);
    
    // Add model ID, max tokens, and temperature to the key
    const modelPart = modelId || 'default';
    
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
      return cached ? JSON.parse(cached) : null;
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
  private async cacheResponse(cacheKey: string, response: any) {
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
  private async sendToModel(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number
  ): Promise<RouterResponse> {
    try {
      // In a real implementation, this would use model adapters
      // For this proof of concept, we'll just return a simulated response
      const simulatedResponse = `This is a simulated response from ${modelId} to: "${prompt}"`;
      
      // Simulate token counting
      const promptTokens = Math.ceil(prompt.length / 4);
      const completionTokens = Math.ceil(simulatedResponse.length / 4);
      
      // Log the model call
      this.fastify.log.info({
        modelId,
        promptTokens,
        completionTokens,
        maxTokens,
        temperature,
      }, 'Model call completed');
      
      // Create and return the response
      const response: RouterResponse = {
        response: simulatedResponse,
        model_used: modelId,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        classification: {
          intent: 'unknown',
          confidence: 0.5,
        },
      };
      
      return response;
    } catch (error) {
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
}

// Factory function to create a router service
export function createRouterService(fastify: FastifyInstance) {
  return new RouterService(fastify);
}

export default createRouterService;