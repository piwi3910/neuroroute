import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { BaseModelAdapter, ModelResponse, ModelRequestOptions, ModelDetails } from '../../src/models/base-adapter.js';

// Create a concrete implementation of the abstract class for testing
class TestModelAdapter extends BaseModelAdapter {
  public isAvailableMock = jest.fn().mockResolvedValue(true);
  public getCapabilitiesMock = jest.fn().mockReturnValue(['text-generation']);
  public getDetailsMock = jest.fn().mockReturnValue({
    provider: 'test',
    version: 'v1.0',
    contextWindow: 4096
  });
  public generateCompletionMock = jest.fn().mockResolvedValue({
    text: 'Test response',
    tokens: { prompt: 10, completion: 20, total: 30 },
    model: 'test-model',
    processingTime: 0.5
  });
  public countTokensMock = jest.fn().mockReturnValue(10);

  constructor(fastify: FastifyInstance, modelId: string) {
    super(fastify, modelId);
  }

  async isAvailable(): Promise<boolean> {
    return this.isAvailableMock();
  }

  getCapabilities(): string[] {
    return this.getCapabilitiesMock();
  }

  getDetails(): ModelDetails {
    return this.getDetailsMock();
  }

  async generateCompletion(
    prompt: string,
    options?: ModelRequestOptions
  ): Promise<ModelResponse> {
    this.logRequest(prompt, options);
    const response = await this.generateCompletionMock(prompt, options);
    this.logResponse(response);
    return response;
  }

  countTokens(text: string): number {
    return this.countTokensMock(text);
  }

  // Expose protected methods for testing
  public testLogRequest(prompt: string, options?: ModelRequestOptions): void {
    this.logRequest(prompt, options);
  }

  public testLogResponse(response: ModelResponse): void {
    this.logResponse(response);
  }
}

describe('Base Model Adapter', () => {
  let app: FastifyInstance;
  let adapter: TestModelAdapter;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Create test adapter
    adapter = new TestModelAdapter(app, 'test-model');
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the correct model ID', () => {
      expect(adapter.getModelId()).toBe('test-model');
    });
  });

  describe('getModelId', () => {
    it('should return the model ID', () => {
      expect(adapter.getModelId()).toBe('test-model');
    });
  });

  describe('isAvailable', () => {
    it('should call the implementation method', async () => {
      adapter.isAvailableMock.mockResolvedValue(true);
      
      const result = await adapter.isAvailable();
      
      expect(result).toBe(true);
      expect(adapter.isAvailableMock).toHaveBeenCalled();
    });
  });

  describe('getCapabilities', () => {
    it('should call the implementation method', () => {
      adapter.getCapabilitiesMock.mockReturnValue(['text-generation', 'code-generation']);
      
      const result = adapter.getCapabilities();
      
      expect(result).toEqual(['text-generation', 'code-generation']);
      expect(adapter.getCapabilitiesMock).toHaveBeenCalled();
    });
  });

  describe('getDetails', () => {
    it('should call the implementation method', () => {
      adapter.getDetailsMock.mockReturnValue({
        provider: 'test',
        version: '1.0',
        contextWindow: 4096
      });
      
      const result = adapter.getDetails();
      
      expect(result).toEqual({
        provider: 'test',
        version: '1.0',
        contextWindow: 4096
      });
      expect(adapter.getDetailsMock).toHaveBeenCalled();
    });
  });

  describe('generateCompletion', () => {
    it('should call the implementation method with correct parameters', async () => {
      const prompt = 'Test prompt';
      const options = { maxTokens: 100, temperature: 0.7 };
      
      adapter.generateCompletionMock.mockResolvedValue({
        text: 'Test response',
        tokens: { prompt: 10, completion: 20, total: 30 },
        model: 'test-model',
        processingTime: 0.5
      });
      
      const result = await adapter.generateCompletion(prompt, options);
      
      expect(result).toEqual({
        text: 'Test response',
        tokens: { prompt: 10, completion: 20, total: 30 },
        model: 'test-model',
        processingTime: 0.5
      });
      expect(adapter.generateCompletionMock).toHaveBeenCalledWith(prompt, options);
    });
  });

  describe('countTokens', () => {
    it('should call the implementation method', () => {
      adapter.countTokensMock.mockReturnValue(25);
      
      const result = adapter.countTokens('Test text');
      
      expect(result).toBe(25);
      expect(adapter.countTokensMock).toHaveBeenCalledWith('Test text');
    });
  });

  describe('logRequest', () => {
    it('should log the request details', () => {
      // Mock the logger
      const logSpy = jest.spyOn(app.log, 'debug').mockImplementation();
      
      adapter.testLogRequest('Test prompt', { maxTokens: 100 });
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'test-model',
          promptLength: 11,
          options: { maxTokens: 100 }
        }),
        'Model request'
      );
    });
  });

  describe('logResponse', () => {
    it('should log the response details', () => {
      // Mock the logger
      const logSpy = jest.spyOn(app.log, 'debug').mockImplementation();
      
      const response: ModelResponse = {
        text: 'Test response',
        tokens: { prompt: 10, completion: 20, total: 30 },
        model: 'test-model',
        processingTime: 0.5
      };
      
      adapter.testLogResponse(response);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'test-model',
          tokens: { prompt: 10, completion: 20, total: 30 },
          processingTime: 0.5
        }),
        'Model response'
      );
    });
  });
});