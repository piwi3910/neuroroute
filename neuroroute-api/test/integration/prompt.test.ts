import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import promptRoutes from '../../src/routes/prompt.js';
import { PreprocessorService } from '../../src/services/preprocessor/interfaces.js';
import { ClassifierService, ClassifiedIntent, ClassifierRegistry, Classifier } from '../../src/services/classifier/interfaces.js';
import { RoutingEngine, NormalizationEngine, RoutingOptions, RoutingResult, NormalizationOptions, ModelResponse, RouterService, RoutingStrategy, Normalizer } from '../../src/services/router/interfaces.js';
import { BaseModelAdapter } from '../../src/models/base-adapter.js';
import AdapterRegistryDefault from '../../src/models/adapter-registry.js';

// --- Mocks (without explicit jest.Mocked types) ---
const mockPreprocessor = {
  process: jest.fn(),
  registerPreprocessor: jest.fn(),
  getPreprocessor: jest.fn(),
  getAllPreprocessors: jest.fn(),
};

const mockClassifier = {
    name: 'mock-classifier',
    isEnabled: jest.fn().mockReturnValue(true),
    classify: jest.fn(),
};

const mockClassifierRegistry = {
    register: jest.fn(),
    unregister: jest.fn(),
    get: jest.fn().mockReturnValue(mockClassifier),
    getAll: jest.fn().mockReturnValue([mockClassifier]),
    getEnabled: jest.fn().mockReturnValue([mockClassifier]),
    setDefault: jest.fn(),
    getDefault: jest.fn().mockReturnValue(mockClassifier),
    classify: jest.fn(),
};

const mockClassifierService = {
  classifyPrompt: jest.fn(),
  registry: mockClassifierRegistry,
};

const mockRoutingStrategy = {
    name: 'mock-strategy',
    route: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
};

const mockRoutingEngine = {
  route: jest.fn(),
  registerStrategy: jest.fn(),
  getStrategy: jest.fn().mockReturnValue(mockRoutingStrategy),
  getAllStrategies: jest.fn().mockReturnValue([mockRoutingStrategy]),
  getEnabledStrategies: jest.fn().mockReturnValue([mockRoutingStrategy]),
  setDefaultStrategy: jest.fn(),
  getDefaultStrategy: jest.fn().mockReturnValue(mockRoutingStrategy),
  selectStrategy: jest.fn().mockReturnValue(mockRoutingStrategy),
};

const mockNormalizer = {
    name: 'mock-normalizer',
    provider: 'mock-provider',
    normalize: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
};

const mockNormalizationEngine = {
  normalize: jest.fn(),
  registerNormalizer: jest.fn(),
  getNormalizer: jest.fn().mockReturnValue(mockNormalizer),
  getAllNormalizers: jest.fn().mockReturnValue([mockNormalizer]),
  getEnabledNormalizers: jest.fn().mockReturnValue([mockNormalizer]),
  selectNormalizer: jest.fn().mockReturnValue(mockNormalizer),
};

const mockAdapter = {
  modelId: 'mock-adapter-model',
  provider: 'mock-provider',
  generateCompletion: jest.fn(),
  chatCompletion: jest.fn(),
};

const mockModelsRegistry = {
  getModelAdapter: jest.fn().mockReturnValue(mockAdapter),
  clearAdapterCache: jest.fn(),
  getCachedAdapters: jest.fn().mockReturnValue(new Map()),
};
// --- End Mocks ---

describe('Prompt Endpoint - New Flow Architecture', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    app = Fastify({
      logger: false
    });

    // Decorate the app instance with mocks, casting to help TS
    app.decorate('preprocessor', mockPreprocessor as unknown as PreprocessorService);
    app.decorate('classifier', mockClassifierService as unknown as ClassifierService);
    app.decorate('router', {
      routing: mockRoutingEngine as unknown as RoutingEngine,
      normalization: mockNormalizationEngine as unknown as NormalizationEngine,
    });
    app.decorate('models', mockModelsRegistry as unknown as typeof AdapterRegistryDefault);
    app.decorate('authenticate', async () => {});

    await app.register(promptRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /', () => {
    const testPrompt = 'Test prompt about Fastify plugins';
    const preprocessedPrompt = 'test prompt about fastify plugins';
    const classificationResult: ClassifiedIntent = {
      type: 'technical_question',
      complexity: 'medium',
      features: ['fastify', 'plugins'],
      priority: 'medium',
      confidence: 0.85,
      tokens: { estimated: 5, completion: 50 },
      language: 'typescript'
    };
    const routingResult: RoutingResult = {
      modelId: 'gpt-4-test',
      provider: 'openai',
    };
    const normalizedPrompt = 'Normalized prompt for gpt-4-test';
    // Add missing properties model and processingTime
    const modelResponse: ModelResponse = {
      text: 'This is the final model response.',
      tokens: { prompt: 15, completion: 30, total: 45 },
      model: routingResult.modelId, // Ensure model property is present
      processingTime: 123, // Ensure processingTime property is present
    };
     const specificModelResponse: ModelResponse = {
      text: 'This is the final model response.',
      tokens: { prompt: 15, completion: 30, total: 45 },
      model: 'user-override-model', // Ensure model property is present
      processingTime: 123, // Ensure processingTime property is present
    };


    it('should execute the full pipeline successfully', async () => {
      // Setup mocks for a successful flow
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockResolvedValue(classificationResult as any);
      mockRoutingEngine.route.mockResolvedValue(routingResult as any);
      mockNormalizationEngine.normalize.mockResolvedValue(normalizedPrompt as any);
      mockModelsRegistry.getModelAdapter.mockReturnValue(mockAdapter);
      mockAdapter.generateCompletion.mockResolvedValue(modelResponse as any);

      const requestPayload = {
        prompt: testPrompt,
        max_tokens: 150,
        temperature: 0.6,
        classifierOptions: { detailed: true },
        routingOptions: { latencyOptimize: true },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: requestPayload,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      expect(payload).toHaveProperty('response', modelResponse.text);
      expect(payload).toHaveProperty('model_used', routingResult.modelId);
      expect(payload).toHaveProperty('classification', classificationResult);
      expect(payload).toHaveProperty('tokens', modelResponse.tokens);
      expect(payload).toHaveProperty('processing_time');
      expect(payload.processing_time).toHaveProperty('total');
      expect(payload.processing_time).toHaveProperty('preprocessing');
      expect(payload.processing_time).toHaveProperty('classification');
      expect(payload.processing_time).toHaveProperty('routing');
      expect(payload.processing_time).toHaveProperty('normalization');
      expect(payload.processing_time).toHaveProperty('model_generation');
      expect(payload).toHaveProperty('request_id');

      expect(mockPreprocessor.process).toHaveBeenCalledTimes(1);
      expect(mockPreprocessor.process).toHaveBeenCalledWith(testPrompt, expect.objectContaining({ temperature: 0.6 }));

      expect(mockClassifierService.classifyPrompt).toHaveBeenCalledTimes(1);
      expect(mockClassifierService.classifyPrompt).toHaveBeenCalledWith(preprocessedPrompt, requestPayload.classifierOptions);

      expect(mockRoutingEngine.route).toHaveBeenCalledTimes(1);
      expect(mockRoutingEngine.route).toHaveBeenCalledWith(preprocessedPrompt, classificationResult, requestPayload.routingOptions);

      expect(mockNormalizationEngine.normalize).toHaveBeenCalledTimes(1);
      expect(mockNormalizationEngine.normalize).toHaveBeenCalledWith(preprocessedPrompt, routingResult.modelId, expect.any(Object));

      expect(mockModelsRegistry.getModelAdapter).toHaveBeenCalledTimes(1);
      expect(mockModelsRegistry.getModelAdapter).toHaveBeenCalledWith(app, routingResult.modelId);

      expect(mockAdapter.generateCompletion).toHaveBeenCalledTimes(1);
      expect(mockAdapter.generateCompletion).toHaveBeenCalledWith(normalizedPrompt, expect.objectContaining({ max_tokens: 150, temperature: 0.6 }));
    });

     it('should use user-provided model_id override', async () => {
      const userModelId = 'user-override-model';
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockResolvedValue(classificationResult as any);
      mockRoutingEngine.route.mockResolvedValue(routingResult as any);
      mockNormalizationEngine.normalize.mockResolvedValue(normalizedPrompt as any);

      const specificMockAdapter = {
        modelId: userModelId,
        provider: 'override-provider',
        generateCompletion: jest.fn().mockResolvedValue(specificModelResponse as any),
        chatCompletion: jest.fn(),
      };
      mockModelsRegistry.getModelAdapter.mockReturnValue(specificMockAdapter as unknown as BaseModelAdapter);


      const requestPayload = {
        prompt: testPrompt,
        model_id: userModelId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: requestPayload,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('model_used', userModelId);

      expect(mockNormalizationEngine.normalize).toHaveBeenCalledWith(preprocessedPrompt, userModelId, expect.any(Object));
      expect(mockModelsRegistry.getModelAdapter).toHaveBeenCalledWith(app, userModelId);
      expect(specificMockAdapter.generateCompletion).toHaveBeenCalledWith(normalizedPrompt, expect.any(Object));

      expect(mockRoutingEngine.route).toHaveBeenCalledTimes(1);
    });

    it('should return 400 for empty prompt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: '' },
      });
      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toContain('Prompt is required');
      expect(mockPreprocessor.process).not.toHaveBeenCalled();
    });

    it('should return 400 for missing prompt', async () => {
       const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { some_other_param: 'value' },
      });
      expect(response.statusCode).toBe(400);
       const payload = JSON.parse(response.payload);
       expect(payload.message).toContain("body must have required property 'prompt'");
       expect(mockPreprocessor.process).not.toHaveBeenCalled();
    });

    it('should handle error during preprocessing', async () => {
      const error = new Error('Preprocessing failed');
      mockPreprocessor.process.mockRejectedValue(error as any);

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: testPrompt },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Preprocessing failed');
      expect(payload.code).toBe('PROMPT_PROCESSING_FAILED');
      expect(mockClassifierService.classifyPrompt).not.toHaveBeenCalled();
    });

    it('should handle error during classification', async () => {
      const error = new Error('Classification failed');
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockRejectedValue(error as any);

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: testPrompt },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Classification failed');
      expect(mockRoutingEngine.route).not.toHaveBeenCalled();
    });

    it('should handle error during routing', async () => {
      const error = new Error('Routing failed');
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockResolvedValue(classificationResult as any);
      mockRoutingEngine.route.mockRejectedValue(error as any);

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: testPrompt },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Routing failed');
      expect(mockNormalizationEngine.normalize).not.toHaveBeenCalled();
    });

    it('should handle error during normalization', async () => {
      const error = new Error('Normalization failed');
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockResolvedValue(classificationResult as any);
      mockRoutingEngine.route.mockResolvedValue(routingResult as any);
      mockNormalizationEngine.normalize.mockRejectedValue(error as any);

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: testPrompt },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Normalization failed');
      expect(mockModelsRegistry.getModelAdapter).not.toHaveBeenCalled();
    });

     it('should handle error getting model adapter', async () => {
      const error = new Error('Adapter not found');
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockResolvedValue(classificationResult as any);
      mockRoutingEngine.route.mockResolvedValue(routingResult as any);
      mockNormalizationEngine.normalize.mockResolvedValue(normalizedPrompt as any);
      mockModelsRegistry.getModelAdapter.mockImplementation(() => { throw error; });

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: testPrompt },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Adapter not found');
      expect(mockAdapter.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle error during model generation', async () => {
      const error = new Error('Model generation failed');
      mockPreprocessor.process.mockResolvedValue(preprocessedPrompt as any);
      mockClassifierService.classifyPrompt.mockResolvedValue(classificationResult as any);
      mockRoutingEngine.route.mockResolvedValue(routingResult as any);
      mockNormalizationEngine.normalize.mockResolvedValue(normalizedPrompt as any);
      mockModelsRegistry.getModelAdapter.mockReturnValue(mockAdapter);
      mockAdapter.generateCompletion.mockRejectedValue(error as any);

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { prompt: testPrompt },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Model generation failed');
    });
  });
});