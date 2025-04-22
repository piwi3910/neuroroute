import { FastifyInstance } from 'fastify';

// Model router service
export class RouterService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Route a prompt to the appropriate model
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
  ) {
    try {
      // If a specific model is requested, use it
      if (modelId) {
        return this.sendToModel(modelId, prompt, maxTokens, temperature);
      }

      // Otherwise, classify the prompt and select the best model
      const classifiedIntent = await this.classifyPrompt(prompt);
      const selectedModel = this.selectModel(classifiedIntent);

      // Check cache before sending to model
      const cacheKey = this.generateCacheKey(prompt, selectedModel, maxTokens, temperature);
      const cachedResponse = await this.checkCache(cacheKey);

      if (cachedResponse) {
        this.fastify.log.info({ model: selectedModel }, 'Cache hit');
        return {
          ...cachedResponse,
          cached: true,
        };
      }

      // Send to model and cache the response
      const response = await this.sendToModel(selectedModel, prompt, maxTokens, temperature);
      await this.cacheResponse(cacheKey, response);

      return response;
    } catch (error) {
      this.fastify.log.error(error);
      throw new Error('Failed to route prompt');
    }
  }

  /**
   * Classify the prompt to determine intent
   * @param prompt The user prompt
   * @returns The classified intent
   */
  private async classifyPrompt(prompt: string) {
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
  private selectModel(intent: any) {
    // In a real implementation, this would use a model selection algorithm
    // For this proof of concept, we'll just return a default model
    return 'gpt-4';
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
    modelId: string,
    maxTokens: number,
    temperature: number
  ) {
    // Simple cache key generation
    return `${modelId}:${maxTokens}:${temperature}:${prompt}`;
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
  ) {
    // In a real implementation, this would use model adapters
    // For this proof of concept, we'll just return a simulated response
    const simulatedResponse = `This is a simulated response from ${modelId} to: "${prompt}"`;
    
    // Simulate token counting
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(simulatedResponse.length / 4);
    
    return {
      response: simulatedResponse,
      model_used: modelId,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
    };
  }
}

// Factory function to create a router service
export function createRouterService(fastify: FastifyInstance) {
  return new RouterService(fastify);
}

export default createRouterService;