import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { BaseModelAdapter, ModelResponse, ModelRequestOptions, StreamingChunk } from './base-adapter';

// OpenAI API response interface
interface OpenAIResponse {
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

// OpenAI model adapter
export class OpenAIAdapter extends BaseModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private capabilities: string[];
  private details: Record<string, any>;

  constructor(fastify: FastifyInstance, modelId: string) {
    super(fastify, modelId);
    
    // Get API key from environment
    const config = (fastify as any).config;
    this.apiKey = config?.OPENAI_API_KEY || '';
    this.baseUrl = 'https://api.openai.com/v1';
    
    // Set capabilities based on model
    this.capabilities = ['text-generation'];
    if (modelId.includes('gpt-4')) {
      this.capabilities.push('code-generation', 'reasoning');
    }
    
    // Set model details
    this.details = {
      provider: 'OpenAI',
      version: modelId.includes('-') ? modelId.split('-').pop() : 'latest',
      contextWindow: modelId.includes('gpt-4') ? 8192 : 4096,
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
        throw new Error('OpenAI API key not configured');
      }

      // Prepare request
      const requestOptions = {
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
        stop: options?.stop,
        stream: false
      };

      // Make request to OpenAI API
      const response = await axios.post<OpenAIResponse>(
        `${this.baseUrl}/chat/completions`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      // Extract response text
      const responseText = response.data.choices[0]?.message?.content || '';
      
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
      this.fastify.log.error(error, `OpenAI API error for model ${this.modelId}`);
      
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
        throw new Error('OpenAI API key not configured');
      }

      // Prepare request
      const requestOptions = {
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
        stop: options?.stop,
        stream: true
      };

      // Make request to OpenAI API
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          responseType: 'stream'
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
      this.fastify.log.error(error, `OpenAI streaming API error for model ${this.modelId}`);
      
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

// Factory function to create an OpenAI adapter
export function createOpenAIAdapter(
  fastify: FastifyInstance,
  modelId: string
): BaseModelAdapter {
  return new OpenAIAdapter(fastify, modelId);
}

export default createOpenAIAdapter;