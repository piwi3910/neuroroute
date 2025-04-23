import { FastifyInstance } from 'fastify';
import axios from 'axios';
import {
  BaseModelAdapter,
  ModelResponse,
  ModelRequestOptions,
  StreamingChunk,
  RawProviderResponse,
  ModelDetails,
  ChatMessage,
  AssistantMessage,
  FunctionCall,
  ToolCall,
  FunctionDefinition,
  ToolDefinition
} from './base-adapter.js';
import { errors, isRetryableError, classifyExternalError } from '../utils/error-handler.js';

// LMStudio API response interface
interface LMStudioResponse extends RawProviderResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    message?: {
      role: string;
      content: string | null;
      function_call?: FunctionCall;
      tool_calls?: ToolCall[];
    };
    delta?: {
      content?: string;
      function_call?: { name?: string; arguments?: string };
      tool_calls?: { index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }[];
    };
    text?: string;
    index: number;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// LMStudio-specific request options
export interface LMStudioRequestOptions extends ModelRequestOptions {
  // Existing options inherited from ModelRequestOptions
  
  // New options
  messages?: ChatMessage[];      // Full message history
  systemMessage?: string;        // Shorthand for system message
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

// Type for external API errors that can be classified
export interface LMStudioError {
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

// LM Studio model adapter
export class LMStudioAdapter extends BaseModelAdapter {
  private baseUrl: string;
  private timeout: number;
  private capabilities: string[];
  private details: ModelDetails;

  constructor(fastify: FastifyInstance, modelId: string) {
    super(fastify, modelId);
    
    // Initialize with default values, will be loaded on demand
    this.baseUrl = 'http://localhost:1234/v1';
    this.timeout = 60000; // Default 60 second timeout
    
    // Set capabilities based on model
    this.capabilities = ['text-generation'];
    if (modelId.includes('llama') || modelId.includes('mistral')) {
      this.capabilities.push('code-generation');
    }
    
    // Set model details
    this.details = {
      provider: 'LMStudio',
      version: 'local',
      contextWindow: 4096, // Default context window, can be overridden based on model
    };
    
    // Load configuration
    this.loadConfig();
  }
  
  /**
   * Load configuration from config manager or environment
   */
  private async loadConfig(): Promise<void> {
    try {
      // Get config manager
      const configManager = this.fastify.configManager;
      
      if (configManager) {
        // Try to get URL from config manager
        const url = await configManager.get<string>('LMSTUDIO_URL', this.baseUrl);
        if (url) {
          this.baseUrl = url;
        }
        
        // Try to get timeout from config manager
        const timeout = await configManager.get<number>('LMSTUDIO_TIMEOUT', this.timeout);
        if (timeout) {
          this.timeout = timeout;
        }
      } else {
        // Fall back to environment variables
        const config = (this.fastify as any).config;
        this.baseUrl = config?.LMSTUDIO_URL || this.baseUrl;
        this.timeout = config?.LMSTUDIO_TIMEOUT || this.timeout;
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to load LMStudio configuration');
      
      // Fall back to environment variables
      const config = (this.fastify as any).config;
      this.baseUrl = config?.LMSTUDIO_URL || this.baseUrl;
      this.timeout = config?.LMSTUDIO_TIMEOUT || this.timeout;
    }
  }

  /**
   * Check if the model is available
   * @returns True if the model is available
   */
  async isAvailable(): Promise<boolean> {
    // If configuration is not loaded yet, try to load it
    if (!this.baseUrl) {
      await this.loadConfig();
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        timeout: 5000, // Short timeout for health check
      });
      return response.status === 200;
    } catch (error) {
      this.fastify.log.error(error, `LM Studio health check failed for model ${this.modelId}`);
      return false;
    }
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
   * Generate a completion for a prompt with retry logic
   * @param prompt The prompt to complete
   * @param options Request options
   * @returns The model response
   */
  async generateCompletion(
    prompt: string,
    options?: LMStudioRequestOptions
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    this.logRequest(prompt, options);

    // Configure retry settings
    const maxRetries = options?.maxRetries ?? 3;
    const initialBackoff = options?.initialBackoff ?? 1000; // 1 second
    let retryCount = 0;
    let lastError: Error | null = null;

    // Circuit breaker state
    const circuitBreakerKey = `circuit_breaker:lmstudio:${this.modelId}`;
    const circuitState = await this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'open') {
      this.fastify.log.warn({
        modelId: this.modelId,
        provider: 'lmstudio',
        circuitState
      }, 'Circuit breaker open, failing fast');
      
      throw errors.model.unavailable(
        `LMStudio API circuit breaker open for model ${this.modelId}`,
        'lmstudio',
        this.modelId,
        { circuitState },
        false
      );
    }

    while (retryCount <= maxRetries) {
      try {
        // Prepare request
        // Handle different message formats
        let messages: ChatMessage[];
        
        if (options?.messages && options.messages.length > 0) {
          // Use provided messages if available
          messages = options.messages;
        } else {
          // Build messages from prompt and optional system message
          messages = [];
          
          // Add system message if provided or use default
          if (options?.systemMessage) {
            messages.push({
              role: 'system',
              content: options.systemMessage
            });
          } else {
            messages.push({
              role: 'system',
              content: "You are a helpful assistant."
            });
          }
          
          // Add user message from prompt
          messages.push({
            role: 'user',
            content: prompt
          });
        }
        
        // Prepare request options
        const requestOptions: Record<string, any> = {
          model: this.modelId,
          messages: messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          presence_penalty: options?.presencePenalty ?? 0,
          stop: options?.stop,
          stream: false
        };
        
        // Add function calling options if provided
        if (options?.functions && options.functions.length > 0) {
          requestOptions.functions = options.functions;
          
          if (options.functionCall) {
            requestOptions.function_call = options.functionCall;
          }
        }
        
        // Add tool options if provided
        if (options?.tools && options.tools.length > 0) {
          requestOptions.tools = options.tools;
          
          if (options.toolChoice) {
            requestOptions.tool_choice = options.toolChoice;
          }
        }

        // Make request to LM Studio API
        const response = await axios.post<LMStudioResponse>(
          `${this.baseUrl}/chat/completions`,
          requestOptions,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: options?.timeoutMs ?? this.timeout
          }
        );

        // Reset circuit breaker on success if it was half-open
        if (circuitState === 'half-open') {
          await this.resetCircuitBreaker(circuitBreakerKey);
        }

        // Extract response text
        const responseText = response.data.choices[0]?.message?.content ?? '';
        
        // Extract function call or tool calls if present
        const functionCall = response.data.choices[0]?.message?.function_call;
        const toolCalls = response.data.choices[0]?.message?.tool_calls;
        
        // Handle token usage - LM Studio may not provide token counts
        let tokenUsage = {
          prompt: 0,
          completion: 0,
          total: 0
        };
        
        if (response.data.usage) {
          tokenUsage = {
            prompt: response.data.usage.prompt_tokens,
            completion: response.data.usage.completion_tokens,
            total: response.data.usage.total_tokens,
          };
        } else {
          // Estimate token count based on text length (very approximate)
          const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(messages);
          tokenUsage = {
            prompt: this.countTokens(promptText),
            completion: this.countTokens(responseText),
            total: this.countTokens(promptText) + this.countTokens(responseText),
          };
        }
        
        // Create model response
        const modelResponse: ModelResponse = {
          text: responseText,
          tokens: tokenUsage,
          model: this.modelId,
          processingTime: (Date.now() - startTime) / 1000,
          raw: response.data,
          // Add function/tool call results if present
          functionCall: functionCall,
          toolCalls: toolCalls,
          // Add full conversation history
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: responseText,
              ...(functionCall ? { function_call: functionCall } : {}),
              ...(toolCalls ? { tool_calls: toolCalls } : {})
            } as AssistantMessage
          ]
        };

        this.logResponse(modelResponse);
        return modelResponse;
      } catch (error) {
        lastError = error as Error;
        
        // Classify the error
        const modelError = classifyExternalError(error as LMStudioError, 'lmstudio', this.modelId);
        
        // Log the error with context
        this.fastify.log.error({
          error: modelError,
          retryCount,
          maxRetries,
          modelId: this.modelId,
          provider: 'lmstudio'
        }, `LMStudio API error for model ${this.modelId}: ${modelError.message}`);
        
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
        }, `Retrying LMStudio request after ${backoff}ms`);
        
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
      `LMStudio API failed after ${maxRetries} retries`,
      'lmstudio',
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
          provider: 'lmstudio',
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
          provider: 'lmstudio',
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
   * Generate a streaming completion for a prompt with retry logic
   * @param prompt The prompt to complete
   * @param options Request options
   * @yields Streaming chunks of the response
   */
  async *generateCompletionStream(
    prompt: string,
    options?: LMStudioRequestOptions
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    this.logRequest(prompt, { ...options, stream: true });

    // Configure retry settings
    const maxRetries = options?.maxRetries ?? 2; // Fewer retries for streaming
    const initialBackoff = options?.initialBackoff ?? 1000; // 1 second
    let retryCount = 0;

    // Circuit breaker state
    const circuitBreakerKey = `circuit_breaker:lmstudio:${this.modelId}:stream`;
    const circuitState = await this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'open') {
      this.fastify.log.warn({
        modelId: this.modelId,
        provider: 'lmstudio',
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
        // Handle different message formats
        let messages: ChatMessage[];
        
        if (options?.messages && options.messages.length > 0) {
          // Use provided messages if available
          messages = options.messages;
        } else {
          // Build messages from prompt and optional system message
          messages = [];
          
          // Add system message if provided or use default
          if (options?.systemMessage) {
            messages.push({
              role: 'system',
              content: options.systemMessage
            });
          } else {
            messages.push({
              role: 'system',
              content: "You are a helpful assistant."
            });
          }
          
          // Add user message from prompt
          messages.push({
            role: 'user',
            content: prompt
          });
        }
        
        // Prepare request options
        const requestOptions: Record<string, any> = {
          model: this.modelId,
          messages: messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1,
          frequency_penalty: options?.frequencyPenalty ?? 0,
          presence_penalty: options?.presencePenalty ?? 0,
          stop: options?.stop,
          stream: true
        };
        
        // Add function calling options if provided
        if (options?.functions && options.functions.length > 0) {
          requestOptions.functions = options.functions;
          
          if (options.functionCall) {
            requestOptions.function_call = options.functionCall;
          }
        }
        
        // Add tool options if provided
        if (options?.tools && options.tools.length > 0) {
          requestOptions.tools = options.tools;
          
          if (options.toolChoice) {
            requestOptions.tool_choice = options.toolChoice;
          }
        }

        // Make request to LM Studio API
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          requestOptions,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
            timeout: options?.timeoutMs ?? this.timeout
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
                  delta?: {
                    content?: string;
                    function_call?: { name?: string; arguments?: string };
                    tool_calls?: { index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }[];
                  };
                  finish_reason?: string;
                }[];
              };
              
              if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                const delta = choice.delta || {};
                finishReason = choice.finish_reason;
                
                // Handle different types of content in the delta
                if (delta.content) {
                  // Regular text content
                  const streamingChunk: StreamingChunk = {
                    chunk: delta.content,
                    done: !!finishReason,
                    model: this.modelId,
                    finishReason
                  };
                  
                  this.logStreamingChunk(streamingChunk);
                  yield streamingChunk;
                } else if (delta.function_call) {
                  // Function call - serialize to JSON for streaming
                  const functionCallChunk = JSON.stringify(delta.function_call);
                  
                  const streamingChunk: StreamingChunk = {
                    chunk: `[Function Call]: ${functionCallChunk}`,
                    done: !!finishReason,
                    model: this.modelId,
                    finishReason
                  };
                  
                  this.logStreamingChunk(streamingChunk);
                  yield streamingChunk;
                } else if (delta.tool_calls) {
                  // Tool calls - serialize to JSON for streaming
                  const toolCallsChunk = JSON.stringify(delta.tool_calls);
                  
                  const streamingChunk: StreamingChunk = {
                    chunk: `[Tool Call]: ${toolCallsChunk}`,
                    done: !!finishReason,
                    model: this.modelId,
                    finishReason
                  };
                  
                  this.logStreamingChunk(streamingChunk);
                  yield streamingChunk;
                } else if (finishReason) {
                  // Just a finish reason with no content
                  const streamingChunk: StreamingChunk = {
                    chunk: '',
                    done: true,
                    model: this.modelId,
                    finishReason
                  };
                  
                  this.logStreamingChunk(streamingChunk);
                  yield streamingChunk;
                }
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
        const modelError = classifyExternalError(error as LMStudioError, 'lmstudio', this.modelId);
        
        // Log the error with context
        this.fastify.log.error({
          error: modelError,
          retryCount,
          maxRetries,
          modelId: this.modelId,
          provider: 'lmstudio',
          streaming: true
        }, `LMStudio streaming API error for model ${this.modelId}: ${modelError.message}`);
        
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
        }, `Retrying LMStudio streaming request after ${backoff}ms`);
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Increment retry counter
        retryCount++;
      }
    }
  }
}

// Factory function to create an LM Studio adapter
export function createLMStudioAdapter(
  fastify: FastifyInstance,
  modelId: string
): BaseModelAdapter {
  return new LMStudioAdapter(fastify, modelId);
}

export default createLMStudioAdapter;