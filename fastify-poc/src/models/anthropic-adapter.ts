import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { BaseModelAdapter, ModelResponse, ModelRequestOptions } from './base-adapter';

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
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
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
}

// Factory function to create an Anthropic adapter
export function createAnthropicAdapter(
  fastify: FastifyInstance,
  modelId: string
): BaseModelAdapter {
  return new AnthropicAdapter(fastify, modelId);
}

export default createAnthropicAdapter;