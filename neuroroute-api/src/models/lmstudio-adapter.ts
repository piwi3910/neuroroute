import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { BaseModelAdapter, ModelResponse, ModelRequestOptions, StreamingChunk } from './base-adapter.js';

// LM Studio API response interface
interface LMStudioResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// LM Studio model adapter
export class LMStudioAdapter extends BaseModelAdapter {
  private baseUrl: string;
  private timeout: number;
  private capabilities: string[];
  private details: Record<string, any>;

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
  getDetails(): Record<string, any> {
    return { ...this.details };
  }

  /**
   * Generate a completion for a prompt
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

    try {
      // Prepare system message
      const systemMessage = "You are a helpful assistant.";
      
      // Prepare request
      const requestOptions = {
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        model: this.modelId,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
        stop: options?.stop,
        stream: false
      };

      // Make request to LM Studio API
      const response = await axios.post<LMStudioResponse>(
        `${this.baseUrl}/chat/completions`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      // Extract response text
      const responseText = response.data.choices[0]?.message?.content || '';
      
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
        tokenUsage = {
          prompt: this.countTokens(prompt),
          completion: this.countTokens(responseText),
          total: this.countTokens(prompt) + this.countTokens(responseText),
        };
      }
      
      // Create model response
      const modelResponse: ModelResponse = {
        text: responseText,
        tokens: tokenUsage,
        model: this.modelId,
        processingTime: (Date.now() - startTime) / 1000,
        raw: response.data,
      };

      this.logResponse(modelResponse);
      return modelResponse;
    } catch (error) {
      this.fastify.log.error(error, `LM Studio API error for model ${this.modelId}`);
      
      // Return a simulated response for this proof of concept
      // In a real implementation, we would throw an error or retry
      const simulatedResponse: ModelResponse = {
        text: `[Simulated response due to API error]: ${prompt}`,
        tokens: {
          prompt: this.countTokens(prompt),
          completion: 20,
          total: this.countTokens(prompt) + 20,
        },
        model: this.modelId,
        processingTime: (Date.now() - startTime) / 1000,
      };
      
      return simulatedResponse;
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
  async *generateCompletionStream(
    prompt: string,
    options?: ModelRequestOptions
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    const startTime = Date.now();
    this.logRequest(prompt, { ...options, stream: true });

    try {
      // Prepare system message
      const systemMessage = "You are a helpful assistant.";
      
      // Prepare request
      const requestOptions = {
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        model: this.modelId,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
        stop: options?.stop,
        stream: true
      };

      // Make request to LM Studio API
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: this.timeout
        }
      );

      // Process the streaming response
      const stream = response.data;
      let buffer = '';
      let finishReason: string | undefined;

      for await (const chunk of stream) {
        const lines = (buffer + chunk.toString()).split('\n');
        buffer = lines.pop() || '';

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
            const data = JSON.parse(line.replace(/^data: /, ''));
            if (data.choices && data.choices.length > 0) {
              const choice = data.choices[0];
              const content = choice.delta?.content || '';
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
            this.fastify.log.error(`Error parsing streaming response: ${error}`);
          }
        }
      }

      // Final chunk if not already sent
      const finalChunk: StreamingChunk = {
        chunk: '',
        done: true,
        model: this.modelId,
        finishReason: finishReason || 'stop'
      };
      this.logStreamingChunk(finalChunk);
      yield finalChunk;

    } catch (error) {
      this.fastify.log.error(error, `LM Studio streaming API error for model ${this.modelId}`);
      
      // Yield error chunk
      const errorChunk: StreamingChunk = {
        chunk: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        done: true,
        model: this.modelId,
        error: true,
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.logStreamingChunk(errorChunk);
      yield errorChunk;
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