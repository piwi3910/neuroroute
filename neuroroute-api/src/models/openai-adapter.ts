import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { BaseModelAdapter, ModelResponse, ModelRequestOptions, StreamingChunk, RawProviderResponse, ModelDetails } from './base-adapter.js';
import { errors, isRetryableError, classifyExternalError, ErrorType } from '../utils/error-handler.js';

// OpenAI API response interface as RawProviderResponse
interface OpenAIResponse extends RawProviderResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text?: string;
    message?: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Type for external API errors that can be classified
export interface OpenAIError {
  message?: string;
  code?: string;
  response?: {
    status: number;
    data?: {
      error?: {
        message?: string;
        type?: string;
      };
    };
    headers?: Record<string, string>;
  };
}

// OpenAI model adapter
export class OpenAIAdapter extends BaseModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private capabilities: string[];
  private details: ModelDetails;

  constructor(fastify: FastifyInstance, modelId: string) {
    super(fastify, modelId);
    
    // Initialize with empty API key, will be loaded on demand
    this.apiKey = '';
    this.baseUrl = 'https://api.openai.com/v1';
    
    // Set capabilities based on model
    this.capabilities = ['text-generation'];
    if (modelId.includes('gpt-4')) {
      this.capabilities.push('code-generation', 'reasoning');
    }
    
    // Set model details
    this.details = {
      provider: 'OpenAI',
      version: modelId.includes('-') ? modelId.split('-').pop() ?? 'latest' : 'latest',
      contextWindow: modelId.includes('gpt-4') ? 8192 : 4096,
    };
    
    // Load API key
    void this.loadApiKey();
  }
  
  /**
   * Load API key from config manager or environment
   */
  private async loadApiKey(): Promise<void> {
    try {
      // Get config manager
      const configManager = this.fastify.configManager as { getApiKey: (provider: string) => Promise<string | undefined> } | undefined;
      
      if (configManager) {
        // Try to get API key from config manager
        const apiKey = await configManager.getApiKey('openai');
        if (apiKey) {
          this.apiKey = apiKey;
          return;
        }
      }
      
      // Fall back to environment variable
      const config = this.fastify.config;
      this.apiKey = config?.OPENAI_API_KEY ?? '';
    } catch (error) {
      this.fastify.log.error(error, 'Failed to load OpenAI API key');
      
      // Fall back to environment variable
      const config = this.fastify.config;
      this.apiKey = config?.OPENAI_API_KEY ?? '';
    }
  }

  /**
   * Check if the model is available
   * @returns True if the model is available
   */
  async isAvailable(): Promise<boolean> {
    // If API key is not loaded yet, try to load it
    if (!this.apiKey) {
      await this.loadApiKey();
    }
    return !!this.apiKey;
  }

  /**
   * Get model capabilities
   * @returns Array of capability strings
   */
  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * Get model details
   * @returns Model details object
   */
  getDetails(): ModelDetails {
    return { ...this.details };
  }

  /**
   * Generate a completion for a prompt
   * @param prompt The prompt to complete
   * @param options Request options
   * @returns The model response
   */
  /**
   * Generate a completion for a prompt with retry logic
   * @param prompt The prompt to complete
   * @param options Request options
   * @returns The model response
   */
  async generateCompletion(
    prompt: string,
    options?: ModelRequestOptions
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    this.logRequest(prompt, options);

    // Configure retry settings
    const maxRetries = options?.maxRetries ?? 3;
    const initialBackoff = options?.initialBackoff ?? 1000; // 1 second
    let retryCount = 0;
    let lastError: Error | null = null;

    // Circuit breaker state
    const circuitBreakerKey = `circuit_breaker:openai:${this.modelId}`;
    const circuitState = await this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'open') {
      this.fastify.log.warn({
        modelId: this.modelId,
        provider: 'openai',
        circuitState
      }, 'Circuit breaker open, failing fast');
      
      throw errors.model.unavailable(
        `OpenAI API circuit breaker open for model ${this.modelId}`,
        'openai',
        this.modelId,
        { circuitState },
        false
      );
    }

    while (retryCount <= maxRetries) {
      try {
        // Check if API key is available, try to load it if not
        if (!this.apiKey) {
          await this.loadApiKey();
          if (!this.apiKey) {
            throw errors.model.authentication(
              'OpenAI API key not configured',
              'openai',
              this.modelId
            );
          }
        }

        // Prepare request
        // Use gpt-4.1 as the default model for gpt-4 requests
        let modelName = this.modelId;
        if (this.modelId === 'gpt-4') {
          modelName = 'gpt-4.1';
        }
        
        const requestOptions = {
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          presence_penalty: options?.presencePenalty ?? 0,
          stop: options?.stop,
          stream: false
        };

        // Make request to OpenAI API with timeout
        const response = await axios.post<OpenAIResponse>(
          `${this.baseUrl}/chat/completions`,
          requestOptions,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: options?.timeoutMs ?? 30000 // Default 30 second timeout
          }
        );

        // Reset circuit breaker on success if it was half-open
        if (circuitState === 'half-open') {
          await this.resetCircuitBreaker(circuitBreakerKey);
        }

        // Extract response text
        const responseText = response.data.choices[0]?.message?.content ?? '';
        
        // Create model response
        const modelResponse: ModelResponse = {
          text: responseText,
          tokens: {
            prompt: response.data.usage.prompt_tokens,
            completion: response.data.usage.completion_tokens,
            total: response.data.usage.total_tokens,
          },
          model: this.modelId,
          processingTime: (Date.now() - startTime) / 1000,
          raw: response.data,
        };

        this.logResponse(modelResponse);
        return modelResponse;
      } catch (error) {
        lastError = error as Error;
        
        // Classify the error
        const modelError = classifyExternalError(error as OpenAIError, 'openai', this.modelId);
        
        // Log the error with context
        this.fastify.log.error({
          error: modelError,
          retryCount,
          maxRetries,
          modelId: this.modelId,
          provider: 'openai'
        }, `OpenAI API error for model ${this.modelId}: ${modelError.message}`);
        
        // Check if we should trip the circuit breaker
        if (this.shouldTripCircuitBreaker(modelError)) {
          await this.tripCircuitBreaker(circuitBreakerKey);
          throw modelError;
        }
        
        // If error is not retryable or we've exhausted retries, throw it
        if (!isRetryableError(modelError) || retryCount >= maxRetries) {
          throw modelError;
        }
        
        // Calculate exponential backoff with jitter
        const backoff = this.calculateBackoff(initialBackoff, retryCount);
        
        this.fastify.log.warn({
          retryCount,
          backoff,
          modelId: this.modelId,
          errorCode: modelError.code
        }, `Retrying OpenAI request after ${backoff}ms`);
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Increment retry counter
        retryCount++;
      }
    }
    
    // This should never be reached due to the throw in the loop,
    // but TypeScript needs it for type safety
    if (lastError) {
      throw lastError;
    }
    
    throw errors.model.unavailable(
      `OpenAI API failed after ${maxRetries} retries`,
      'openai',
      this.modelId
    );
  }
  
  /**
   * Calculate backoff time with exponential increase and jitter
   * @param initialBackoff Initial backoff in ms
   * @param retryCount Current retry count
   * @returns Backoff time in ms
   */
  private calculateBackoff(initialBackoff: number, retryCount: number): number {
    // Exponential backoff: initialBackoff * 2^retryCount
    const exponentialBackoff = initialBackoff * Math.pow(2, retryCount);
    
    // Add jitter: random value between 0 and 1 * exponentialBackoff * 0.2 (20%)
    const jitter = Math.random() * exponentialBackoff * 0.2;
    
    // Return backoff with jitter
    return Math.min(exponentialBackoff + jitter, 30000); // Cap at 30 seconds
  }
  
  /**
   * Check if circuit breaker should be tripped
   * @param error Error that occurred
   * @returns True if circuit breaker should be tripped
   */
  private shouldTripCircuitBreaker(error: Error): boolean {
    // Trip circuit breaker for authentication errors, quota exceeded, or content filtered
    if (error.name === 'ModelError') {
      const modelError = error as unknown as { code: string };
      return [
        'MODEL_AUTHENTICATION',
        'MODEL_QUOTA_EXCEEDED',
        'MODEL_CONTENT_FILTERED'
      ].includes(modelError.code);
    }
    
    return false;
  }
  
  /**
   * Get circuit breaker state
   * @param key Circuit breaker key
   * @returns Circuit breaker state: 'closed', 'open', or 'half-open'
   */
  private async getCircuitBreakerState(key: string): Promise<'closed' | 'open' | 'half-open'> {
    try {
      // Try to get from cache if available
      if (this.fastify.redis) {
        const state = await this.fastify.redis.get(key);
        if (state) {
          const parsedState = JSON.parse(state) as { status: 'closed' | 'open' | 'half-open'; timestamp: number };
          const { status, timestamp } = parsedState;
          
          // If circuit is open, check if timeout has elapsed (30 seconds)
          if (status === 'open') {
            const now = Date.now();
            const elapsed = now - timestamp;
            
            // After timeout, move to half-open state
            if (elapsed > 30000) {
              return 'half-open';
            }
            
            return 'open';
          }
          
          return status as 'closed' | 'open' | 'half-open';
        }
      }
      
      // Default to closed if no state found
      return 'closed';
    } catch (error) {
      // If there's an error accessing the cache, default to closed
      this.fastify.log.error(error, 'Error getting circuit breaker state');
      return 'closed';
    }
  }
  
  /**
   * Trip the circuit breaker
   * @param key Circuit breaker key
   */
  private async tripCircuitBreaker(key: string): Promise<void> {
    try {
      if (this.fastify.redis) {
        const state = {
          status: 'open',
          timestamp: Date.now()
        };
        
        // Set circuit breaker state with 60 second TTL
        await this.fastify.redis.set(key, JSON.stringify(state), 'EX', 60);
        
        this.fastify.log.warn({
          modelId: this.modelId,
          provider: 'openai',
          key
        }, 'Circuit breaker tripped');
      }
    } catch (error) {
      this.fastify.log.error(error, 'Error tripping circuit breaker');
    }
  }
  
  /**
   * Reset the circuit breaker
   * @param key Circuit breaker key
   */
  private async resetCircuitBreaker(key: string): Promise<void> {
    try {
      if (this.fastify.redis) {
        const state = {
          status: 'closed',
          timestamp: Date.now()
        };
        
        // Set circuit breaker state with 60 second TTL
        await this.fastify.redis.set(key, JSON.stringify(state), 'EX', 60);
        
        this.fastify.log.info({
          modelId: this.modelId,
          provider: 'openai',
          key
        }, 'Circuit breaker reset');
      }
    } catch (error) {
      this.fastify.log.error(error, 'Error resetting circuit breaker');
    }
  }

  /**
   * Count tokens in a text (approximate)
   * @param text The text to count tokens for
   * @returns The token count
   */
  countTokens(text: string): number {
    // Simple approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate a streaming completion for a prompt
   * @param prompt The prompt to complete
   * @param options Request options
   * @yields Streaming chunks of the response
   */
  /**
   * Generate a streaming completion for a prompt with retry logic
   * @param prompt The prompt to complete
   * @param options Request options
   * @yields Streaming chunks of the response
   */
  async *generateCompletionStream(
    prompt: string,
    options?: ModelRequestOptions
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    this.logRequest(prompt, { ...options, stream: true });

    // Configure retry settings
    const maxRetries = options?.maxRetries ?? 2; // Fewer retries for streaming
    const initialBackoff = options?.initialBackoff ?? 1000; // 1 second
    let retryCount = 0;

    // Circuit breaker state
    const circuitBreakerKey = `circuit_breaker:openai:${this.modelId}:stream`;
    const circuitState = await this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'open') {
      this.fastify.log.warn({
        modelId: this.modelId,
        provider: 'openai',
        circuitState,
        streaming: true
      }, 'Circuit breaker open for streaming, failing fast');
      
      // Yield error chunk
      const errorChunk: StreamingChunk = {
        chunk: `Error: Circuit breaker open for model ${this.modelId}`,
        done: true,
        model: this.modelId,
        error: true,
        errorDetails: 'CIRCUIT_BREAKER_OPEN'
      };
      
      this.logStreamingChunk(errorChunk);
      yield errorChunk;
      return;
    }

    while (retryCount <= maxRetries) {
      try {
        // Check if API key is available, try to load it if not
        if (!this.apiKey) {
          await this.loadApiKey();
          if (!this.apiKey) {
            throw errors.model.authentication(
              'OpenAI API key not configured',
              'openai',
              this.modelId
            );
          }
        }

        // Prepare request
        // Use gpt-4.1 as the default model for gpt-4 requests
        let modelName = this.modelId;
        if (this.modelId === 'gpt-4') {
          modelName = 'gpt-4.1';
        }
        
        const requestOptions = {
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          presence_penalty: options?.presencePenalty ?? 0,
          stop: options?.stop,
          stream: true
        };

        // Make request to OpenAI API with timeout
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          requestOptions,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            responseType: 'stream',
            timeout: options?.timeoutMs ?? 30000 // Default 30 second timeout
          }
        );

        // Reset circuit breaker on success if it was half-open
        if (circuitState === 'half-open') {
          await this.resetCircuitBreaker(circuitBreakerKey);
        }

        // Process the streaming response
        const stream = response.data as NodeJS.ReadableStream;
        let buffer = '';
        let finishReason: string | undefined;

        for await (const chunk of stream) {
          const lines = (buffer + (chunk as Buffer).toString()).split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') {
              const finalChunk: StreamingChunk = {
                chunk: '',
                done: true,
                model: this.modelId,
                finishReason
              };
              this.logStreamingChunk(finalChunk);
              yield finalChunk;
              return;
            }

            try {
              const data = JSON.parse(line.replace(/^data: /, '')) as {
                choices?: {
                  delta?: { content?: string };
                  finish_reason?: string;
                }[];
              };
              
              if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                const content = choice.delta?.content ?? '';
                finishReason = choice.finish_reason;

                const streamingChunk: StreamingChunk = {
                  chunk: content,
                  done: !!finishReason,
                  model: this.modelId,
                  finishReason
                };

                this.logStreamingChunk(streamingChunk);
                yield streamingChunk;
              }
            } catch (error) {
              // Skip invalid JSON
              this.fastify.log.error('Error parsing streaming response', { error: String(error) });
            }
          }
        }

        // Final chunk if not already sent
        const finalChunk: StreamingChunk = {
          chunk: '',
          done: true,
          model: this.modelId,
          finishReason: finishReason ?? 'stop'
        };
        this.logStreamingChunk(finalChunk);
        yield finalChunk;
        return;

      } catch (error) {
        // Classify the error
        const modelError = classifyExternalError(error as OpenAIError, 'openai', this.modelId);
        
        // Log the error with context
        this.fastify.log.error({
          error: modelError,
          retryCount,
          maxRetries,
          modelId: this.modelId,
          provider: 'openai',
          streaming: true
        }, `OpenAI streaming API error for model ${this.modelId}: ${modelError.message}`);
        
        // Check if we should trip the circuit breaker
        if (this.shouldTripCircuitBreaker(modelError)) {
          await this.tripCircuitBreaker(circuitBreakerKey);
          
          // Yield error chunk
          const errorChunk: StreamingChunk = {
            chunk: `Error: ${modelError.message}`,
            done: true,
            model: this.modelId,
            error: true,
            errorDetails: modelError.code
          };
          
          this.logStreamingChunk(errorChunk);
          yield errorChunk;
          return;
        }
        
        // If error is not retryable or we've exhausted retries, yield error chunk
        if (!isRetryableError(modelError) || retryCount >= maxRetries) {
          // Yield error chunk
          const errorChunk: StreamingChunk = {
            chunk: `Error: ${modelError.message}`,
            done: true,
            model: this.modelId,
            error: true,
            errorDetails: modelError.code
          };
          
          this.logStreamingChunk(errorChunk);
          yield errorChunk;
          return;
        }
        
        // Calculate exponential backoff with jitter
        const backoff = this.calculateBackoff(initialBackoff, retryCount);
        
        this.fastify.log.warn({
          retryCount,
          backoff,
          modelId: this.modelId,
          errorCode: modelError.code,
          streaming: true
        }, `Retrying OpenAI streaming request after ${backoff}ms`);
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Increment retry counter
        retryCount++;
      }
    }
  }
}

// Factory function to create an OpenAI adapter
export function createOpenAIAdapter(
  fastify: FastifyInstance,
  modelId: string
): BaseModelAdapter {
  return new OpenAIAdapter(fastify, modelId);
}

export default createOpenAIAdapter;