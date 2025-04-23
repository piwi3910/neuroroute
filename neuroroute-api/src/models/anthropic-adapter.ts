import { FastifyInstance } from 'fastify';
import axios from 'axios';
import {
  BaseModelAdapter,
  ModelResponse,
  ModelRequestOptions,
  StreamingChunk,
  ModelDetails,
  ChatMessage,
  FunctionCall,
  ToolCall,
  ToolDefinition
} from './base-adapter.js';
import { errors, isRetryableError, classifyExternalError } from '../utils/error-handler.js';

// Anthropic-specific request options
export interface AnthropicRequestOptions extends ModelRequestOptions {
  // Existing options inherited from ModelRequestOptions
  
  // New options
  messages?: ChatMessage[];    // Full message history
  systemMessage?: string;      // Shorthand for system message
  tools?: ToolDefinition[];    // Tools that Claude can use
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  thinking?: {                 // Extended thinking configuration
    type: 'enabled';
    budget_tokens: number;
  };
}

// Anthropic API response interface
interface AnthropicResponse {
  id: string;
  type: string;
  model: string;
  role: string;
  content: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
    thinking?: string;
    signature?: string;
  }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string | null;
  stop_sequence: string | null;
  [key: string]: unknown; // Index signature for additional properties
}

// Anthropic streaming event types


// Anthropic model adapter
export class AnthropicAdapter extends BaseModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private capabilities: string[];
  private details: ModelDetails;

  constructor(fastify: FastifyInstance, modelId: string) {
    super(fastify, modelId);
    
    // Initialize with empty API key, will be loaded on demand
    this.apiKey = '';
    this.baseUrl = 'https://api.anthropic.com/v1';
    
    // Set capabilities based on model
    this.capabilities = ['text-generation'];
    if (modelId.includes('claude-3')) {
      this.capabilities.push('code-generation', 'reasoning');
      
      // Add tool usage capability for Claude 3 models
      this.capabilities.push('tool-use');
    }
    
    // Set model details
    this.details = {
      provider: 'Anthropic',
      version: modelId.includes('-') ? modelId.split('-').pop() || 'latest' : 'latest',
      contextWindow: modelId.includes('claude-3-opus') ? 200000 :
                    modelId.includes('claude-3-sonnet') ? 200000 :
                    modelId.includes('claude-3-haiku') ? 200000 : 100000,
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
      const configManager = this.fastify.configManager;
      
      if (configManager) {
        // Try to get API key from config manager
        const apiKey = await configManager.getApiKey('anthropic');
        if (apiKey) {
          this.apiKey = apiKey;
          return;
        }
      }
      
      // Fall back to environment variable
      const config = (this.fastify as any).config;
      this.apiKey = config?.ANTHROPIC_API_KEY || '';
    } catch (error) {
      this.fastify.log.error(error, 'Failed to load Anthropic API key');
      
      // Fall back to environment variable
      const config = (this.fastify as any).config;
      this.apiKey = config?.ANTHROPIC_API_KEY || '';
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
    options?: AnthropicRequestOptions
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    this.logRequest(prompt, options);

    // Configure retry settings
    const maxRetries = options?.maxRetries ?? 3;
    const initialBackoff = options?.initialBackoff ?? 1000; // 1 second
    let retryCount = 0;
    let lastError: Error | null = null;

    // Circuit breaker state
    const circuitBreakerKey = `circuit_breaker:anthropic:${this.modelId}`;
    const circuitState = await this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'open') {
      this.fastify.log.warn({
        modelId: this.modelId,
        provider: 'anthropic',
        circuitState
      }, 'Circuit breaker open, failing fast');
      
      throw errors.model.unavailable(
        `Anthropic API circuit breaker open for model ${this.modelId}`,
        'anthropic',
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
              'Anthropic API key not configured',
              'anthropic',
              this.modelId
            );
          }
        }

        // Use claude-3-7-sonnet-latest as the default model
        let modelName = 'claude-3-7-sonnet-latest';
        
        // If a specific model is requested and it's not the default model pattern, use it
        if (this.modelId !== 'claude-3-sonnet' && this.modelId !== 'claude-3-opus' && this.modelId !== 'claude-3-haiku') {
          modelName = this.modelId;
        }
        
        // Build messages payload
        const anthropicOptions = options;
        const messagesPayload = this.buildMessagesPayload(prompt, anthropicOptions);
        
        // Prepare request options
        const requestOptions: Record<string, any> = {
          model: modelName,
          messages: messagesPayload.messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1,
          stream: false
        };
        
        // Add system message if provided
        if (messagesPayload.system) {
          requestOptions.system = messagesPayload.system;
        }
        
        // Add tools if provided
        if (anthropicOptions?.tools && anthropicOptions.tools.length > 0) {
          requestOptions.tools = anthropicOptions.tools;
          
          if (anthropicOptions.toolChoice) {
            requestOptions.tool_choice = anthropicOptions.toolChoice;
          }
        }
        
        // Add thinking configuration if provided
        if (anthropicOptions?.thinking) {
          requestOptions.thinking = anthropicOptions.thinking;
        }

        // Make request to Anthropic API with timeout
        const response = await axios.post<AnthropicResponse>(
          `${this.baseUrl}/messages`,
          requestOptions,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
            },
            timeout: options?.timeoutMs ?? 30000 // Default 30 second timeout
          }
        );

        // Reset circuit breaker on success if it was half-open
        if (circuitState === 'half-open') {
          await this.resetCircuitBreaker(circuitBreakerKey);
        }

        // Extract response text
        const responseText = response.data.content
          .filter(item => item.type === 'text')
          .map(item => item.text || '')
          .join('');
        
        // Extract tool usage if present
        const toolUsage = this.handleToolUsage(response.data);
        
        // Extract thinking content if present
        const thinkingContent = response.data.content
          .filter(item => item.type === 'thinking')
          .map(item => item.thinking || '')
          .join('');
        
        // Create model response
        const modelResponse: ModelResponse = {
          text: responseText,
          tokens: {
            prompt: response.data.usage.input_tokens,
            completion: response.data.usage.output_tokens,
            total: response.data.usage.input_tokens + response.data.usage.output_tokens,
          },
          model: modelName, // Use the actual model name sent to the API
          processingTime: (Date.now() - startTime) / 1000,
          raw: {
            ...response.data,
            ...(thinkingContent ? { thinking: thinkingContent } : {})
          },
          // Add function/tool call results if present
          ...(toolUsage.functionCall ? { functionCall: toolUsage.functionCall } : {}),
          ...(toolUsage.toolCalls ? { toolCalls: toolUsage.toolCalls } : {}),
          // Add full conversation history
          messages: [
            ...messagesPayload.messages,
            {
              role: 'assistant',
              content: responseText,
              ...(toolUsage.functionCall ? { function_call: toolUsage.functionCall } : {}),
              ...(toolUsage.toolCalls ? { tool_calls: toolUsage.toolCalls } : {})
            }
          ]
        };

        this.logResponse(modelResponse);
        return modelResponse;
      } catch (error) {
        lastError = error as Error;
        
        // Classify the error
        const modelError = classifyExternalError(error as any, 'anthropic', this.modelId);
        
        // Log the error with context
        this.fastify.log.error({
          error: modelError,
          retryCount,
          maxRetries,
          modelId: this.modelId,
          provider: 'anthropic'
        }, `Anthropic API error for model ${this.modelId}: ${modelError.message}`);
        
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
        }, `Retrying Anthropic request after ${backoff}ms`);
        
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
      `Anthropic API failed after ${maxRetries} retries`,
      'anthropic',
      this.modelId
    );
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
    options?: AnthropicRequestOptions
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    this.logRequest(prompt, { ...options, stream: true });

    // Configure retry settings
    const maxRetries = options?.maxRetries ?? 2; // Fewer retries for streaming
    const initialBackoff = options?.initialBackoff ?? 1000; // 1 second
    let retryCount = 0;

    // Circuit breaker state
    const circuitBreakerKey = `circuit_breaker:anthropic:${this.modelId}:stream`;
    const circuitState = await this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'open') {
      this.fastify.log.warn({
        modelId: this.modelId,
        provider: 'anthropic',
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
              'Anthropic API key not configured',
              'anthropic',
              this.modelId
            );
          }
        }

        // Use claude-3-7-sonnet-latest as the default model
        let modelName = 'claude-3-7-sonnet-latest';
        
        // If a specific model is requested and it's not the default model pattern, use it
        if (this.modelId !== 'claude-3-sonnet' && this.modelId !== 'claude-3-opus' && this.modelId !== 'claude-3-haiku') {
          modelName = this.modelId;
        }
        
        // Build messages payload
        const anthropicOptions = options;
        const messagesPayload = this.buildMessagesPayload(prompt, anthropicOptions);
        
        // Prepare request options
        const requestOptions: Record<string, any> = {
          model: modelName,
          messages: messagesPayload.messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1,
          stream: true
        };
        
        // Add system message if provided
        if (messagesPayload.system) {
          requestOptions.system = messagesPayload.system;
        }
        
        // Add tools if provided
        if (anthropicOptions?.tools && anthropicOptions.tools.length > 0) {
          requestOptions.tools = anthropicOptions.tools;
          
          if (anthropicOptions.toolChoice) {
            requestOptions.tool_choice = anthropicOptions.toolChoice;
          }
        }
        
        // Add thinking configuration if provided
        if (anthropicOptions?.thinking) {
          requestOptions.thinking = anthropicOptions.thinking;
        }

        // Make request to Anthropic API with timeout
        const response = await axios.post(
          `${this.baseUrl}/messages`,
          requestOptions,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
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
        const stream = response.data;
        yield* this.parseStreamingEvents(stream);
        return;

      } catch (error) {
        // Classify the error
        const modelError = classifyExternalError(error as any, 'anthropic', this.modelId);
        
        // Log the error with context
        this.fastify.log.error({
          error: modelError,
          retryCount,
          maxRetries,
          modelId: this.modelId,
          provider: 'anthropic',
          streaming: true
        }, `Anthropic streaming API error for model ${this.modelId}: ${modelError.message}`);
        
        // Check if we should trip the circuit breaker
        if (this.shouldTripCircuitBreaker(modelError)) {
          await this.tripCircuitBreaker(circuitBreakerKey);
          
          // Yield error chunk
          const errorChunk: StreamingChunk = {
            chunk: `Error: ${modelError.message}`,
            done: true,
            model: this.modelId, // Revert to original model ID for error chunks
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
        }, `Retrying Anthropic streaming request after ${backoff}ms`);
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Increment retry counter
        retryCount++;
      }
    }
  }

  /**
   * Build messages payload from prompt and options
   * @param prompt The prompt to complete
   * @param options Request options
   * @returns Messages payload
   */
  private buildMessagesPayload(
    prompt: string,
    options?: AnthropicRequestOptions
  ): { messages: any[]; system?: string } {
    // If messages are provided, use them
    if (options?.messages && options.messages.length > 0) {
      // Extract system message if present
      const systemMessage = options.messages.find(m => m.role === 'system');
      const nonSystemMessages = options.messages.filter(m => m.role !== 'system');
      
      return {
        messages: nonSystemMessages.map(m => ({
          role: m.role,
          content: m.content
        })),
        system: systemMessage?.content || undefined
      };
    }
    
    // Otherwise, build from prompt and optional system message
    const messages = [{ role: 'user', content: prompt }];
    
    return {
      messages,
      system: options?.systemMessage
    };
  }

  /**
   * Handle tool usage in response
   * @param response Anthropic API response
   * @returns Function call and tool calls
   */
  private handleToolUsage(
    response: AnthropicResponse
  ): { functionCall?: FunctionCall; toolCalls?: ToolCall[] } {
    const result: { functionCall?: FunctionCall; toolCalls?: ToolCall[] } = {};
    
    // Extract tool calls from content blocks
    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
    
    if (toolUseBlocks.length > 0) {
      // Map to our ToolCall format
      result.toolCalls = toolUseBlocks.map(block => ({
        id: block.id!,
        type: 'function',
        function: {
          name: block.name!,
          arguments: JSON.stringify(block.input)
        }
      }));
      
      // For backward compatibility, also set functionCall if there's exactly one tool call
      if (toolUseBlocks.length === 1) {
        result.functionCall = {
          name: toolUseBlocks[0].name!,
          arguments: JSON.stringify(toolUseBlocks[0].input)
        };
      }
    }
    
    return result;
  }

  /**
   * Parse streaming events from Anthropic API
   * @param stream Readable stream from Anthropic API
   * @returns AsyncGenerator of StreamingChunk
   */
  private async *parseStreamingEvents(
    stream: NodeJS.ReadableStream
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    let buffer = '';
    let finishReason: string | undefined;
    let modelName = this.modelId;
    
    for await (const chunk of stream) {
      const lines = (buffer + (chunk as Buffer).toString()).split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // Parse the event
        const eventRegex = /^event: (.+)$/;
        const dataRegex = /^data: (.+)$/;
        const eventMatch = eventRegex.exec(line);
        const dataMatch = dataRegex.exec(line);
        
        if (!eventMatch || !dataMatch) continue;
        
        try {
          const eventType = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);
          
          switch (eventType) {
            case 'message_start':
              modelName = data.message.model;
              break;
              
            case 'content_block_delta':
              if (data.delta.type === 'text_delta') {
                const streamingChunk: StreamingChunk = {
                  chunk: data.delta.text,
                  done: false,
                  model: modelName
                };
                
                this.logStreamingChunk(streamingChunk);
                yield streamingChunk;
              } else if (data.delta.type === 'thinking_delta' && data.delta.thinking) {
                // For thinking deltas, we could handle them specially if needed
                // For now, we'll just log them
                this.fastify.log.debug({
                  modelId: this.modelId,
                  thinkingDelta: data.delta.thinking.substring(0, 50) + '...'
                }, 'Thinking delta received');
              }
              break;
              
            case 'message_delta':
              finishReason = data.delta.stop_reason;
              break;
              
            case 'message_stop': {
              const finalChunk: StreamingChunk = {
                chunk: '',
                done: true,
                model: modelName,
                finishReason
              };
              
              this.logStreamingChunk(finalChunk);
              yield finalChunk;
              return;
            }
              
            case 'error': {
              const errorChunk: StreamingChunk = {
                chunk: `Error: ${data.error.message}`,
                done: true,
                model: this.modelId,
                error: true,
                errorDetails: data.error.type
              };
              
              this.logStreamingChunk(errorChunk);
              yield errorChunk;
              return;
            }
          }
        } catch (error) {
          // Skip invalid JSON
          this.fastify.log.error('Error parsing streaming response', { error: String(error) });
        }
      }
    }
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
          provider: 'anthropic',
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
          provider: 'anthropic',
          key
        }, 'Circuit breaker reset');
      }
    } catch (error) {
      this.fastify.log.error(error, 'Error resetting circuit breaker');
    }
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
}

// Factory function to create an Anthropic adapter
export function createAnthropicAdapter(
  fastify: FastifyInstance,
  modelId: string
): BaseModelAdapter {
  return new AnthropicAdapter(fastify, modelId);
}

export default createAnthropicAdapter;