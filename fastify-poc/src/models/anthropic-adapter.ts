import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { BaseModelAdapter, ModelResponse, ModelRequestOptions, StreamingChunk } from './base-adapter';

// Anthropic API response interface
interface AnthropicResponse {
  id: string;
  type: string;
  model: string;
  content: {
    type: string;
    text: string;
  }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Anthropic model adapter
export class AnthropicAdapter extends BaseModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private capabilities: string[];
  private details: Record<string, any>;

  constructor(fastify: FastifyInstance, modelId: string) {
    super(fastify, modelId);
    
    // Get API key from environment
    const config = (fastify as any).config;
    this.apiKey = config?.ANTHROPIC_API_KEY || '';
    this.baseUrl = 'https://api.anthropic.com/v1';
    
    // Set capabilities based on model
    this.capabilities = ['text-generation'];
    if (modelId.includes('claude-3')) {
      this.capabilities.push('code-generation', 'reasoning');
    }
    
    // Set model details
    this.details = {
      provider: 'Anthropic',
      version: modelId.includes('-') ? modelId.split('-').pop() : 'latest',
      contextWindow: modelId.includes('claude-3-opus') ? 100000 : 
                    modelId.includes('claude-3-sonnet') ? 200000 : 
                    modelId.includes('claude-3-haiku') ? 200000 : 100000,
    };
  }

  /**
   * Check if the model is available
   * @returns True if the model is available
   */
  async isAvailable(): Promise<boolean> {
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
      // Check if API key is available
      if (!this.apiKey) {
        throw new Error('Anthropic API key not configured');
      }

      // Prepare request
      const requestOptions = {
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 1,
        stream: false
      };

      // Make request to Anthropic API
      const response = await axios.post<AnthropicResponse>(
        `${this.baseUrl}/messages`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
        }
      );

      // Extract response text
      const responseText = response.data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');
      
      // Create model response
      const modelResponse: ModelResponse = {
        text: responseText,
        tokens: {
          prompt: response.data.usage.input_tokens,
          completion: response.data.usage.output_tokens,
          total: response.data.usage.input_tokens + response.data.usage.output_tokens,
        },
        model: this.modelId,
        processingTime: (Date.now() - startTime) / 1000,
        raw: response.data,
      };

      this.logResponse(modelResponse);
      return modelResponse;
    } catch (error) {
      this.fastify.log.error(error, `Anthropic API error for model ${this.modelId}`);
      
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
      // Check if API key is available
      if (!this.apiKey) {
        throw new Error('Anthropic API key not configured');
      }

      // Prepare request
      const requestOptions = {
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 1,
        stream: true
      };

      // Make request to Anthropic API
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          responseType: 'stream'
        }
      );

      // Process the streaming response
      const stream = response.data;
      let buffer = '';
      let stopReason: string | undefined;

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
              finishReason: stopReason
            };
            this.logStreamingChunk(finalChunk);
            yield finalChunk;
            return;
          }

          try {
            const data = JSON.parse(line.replace(/^data: /, ''));
            
            if (data.type === 'content_block_delta') {
              const content = data.delta?.text || '';
              
              const streamingChunk: StreamingChunk = {
                chunk: content,
                done: false,
                model: this.modelId
              };

              this.logStreamingChunk(streamingChunk);
              yield streamingChunk;
            } else if (data.type === 'message_stop') {
              stopReason = data.stop_reason;
              
              const finalChunk: StreamingChunk = {
                chunk: '',
                done: true,
                model: this.modelId,
                finishReason: stopReason
              };
              
              this.logStreamingChunk(finalChunk);
              yield finalChunk;
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
        finishReason: stopReason || 'stop'
      };
      this.logStreamingChunk(finalChunk);
      yield finalChunk;

    } catch (error) {
      this.fastify.log.error(error, `Anthropic streaming API error for model ${this.modelId}`);
      
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

// Factory function to create an Anthropic adapter
export function createAnthropicAdapter(
  fastify: FastifyInstance,
  modelId: string
): BaseModelAdapter {
  return new AnthropicAdapter(fastify, modelId);
}

export default createAnthropicAdapter;