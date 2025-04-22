import { FastifyInstance } from 'fastify';

// Model response interface
export interface ModelResponse {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  processingTime: number;
  raw?: any; // Raw response from the provider
}

// Model request options
export interface ModelRequestOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

// Base model adapter interface
export abstract class BaseModelAdapter {
  protected fastify: FastifyInstance;
  protected modelId: string;

  constructor(fastify: FastifyInstance, modelId: string) {
    this.fastify = fastify;
    this.modelId = modelId;
  }

  /**
   * Get the model ID
   * @returns The model ID
   */
  getModelId(): string {
    return this.modelId;
  }

  /**
   * Check if the model is available
   * @returns True if the model is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get model capabilities
   * @returns Array of capability strings
   */
  abstract getCapabilities(): string[];

  /**
   * Get model details
   * @returns Model details object
   */
  abstract getDetails(): Record<string, any>;

  /**
   * Generate a completion for a prompt
   * @param prompt The prompt to complete
   * @param options Request options
   * @returns The model response
   */
  abstract generateCompletion(
    prompt: string,
    options?: ModelRequestOptions
  ): Promise<ModelResponse>;

  /**
   * Count tokens in a text
   * @param text The text to count tokens for
   * @returns The token count
   */
  abstract countTokens(text: string): number;

  /**
   * Log a request to the model
   * @param prompt The prompt
   * @param options The request options
   */
  protected logRequest(prompt: string, options?: ModelRequestOptions): void {
    this.fastify.log.debug(
      {
        modelId: this.modelId,
        promptLength: prompt.length,
        options,
      },
      'Model request'
    );
  }

  /**
   * Log a response from the model
   * @param response The model response
   */
  protected logResponse(response: ModelResponse): void {
    this.fastify.log.debug(
      {
        modelId: this.modelId,
        tokens: response.tokens,
        processingTime: response.processingTime,
      },
      'Model response'
    );
  }
}

// Factory function to create model adapters
export type ModelAdapterFactory = (
  fastify: FastifyInstance,
  modelId: string
) => BaseModelAdapter;