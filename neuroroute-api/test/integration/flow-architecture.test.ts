/// <reference path="../types/jest-globals.d.ts" />

import { FastifyInstance } from 'fastify';
import { build } from '../helpers/app-builder.js';
import { ModelResponse } from '../../src/models/base-adapter.js';
import { ClassifiedIntent } from '../../src/services/classifier/interfaces.js';
import { RoutingResult } from '../../src/services/router/interfaces.js';

// Mock the model adapters
jest.mock('../../src/models/openai-adapter.js', () => ({
  default: jest.fn((fastify: any, modelId: string) => ({
    getModelId: () => modelId,
    provider: 'openai',
    getCapabilities: () => ['text-generation', 'code-generation', 'reasoning'],
    getDetails: () => ({
      provider: 'OpenAI',
      version: 'latest',
      contextWindow: 8192
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
    generateCompletion: jest.fn().mockImplementation(async (prompt: string) => {
      return {
        text: `OpenAI response for: ${prompt}`,
        tokens: {
          prompt: Math.ceil(prompt.length / 4),
          completion: 50,
          total: Math.ceil(prompt.length / 4) + 50
        },
        model: modelId,
        processingTime: 1.5
      } as ModelResponse;
    }),
    countTokens: (text: string) => Math.ceil(text.length / 4)
  }))
}));

jest.mock('../../src/models/anthropic-adapter.js', () => ({
  default: jest.fn((fastify: any, modelId: string) => ({
    getModelId: () => modelId,
    provider: 'anthropic',
    getCapabilities: () => ['text-generation', 'code-generation', 'reasoning'],
    getDetails: () => ({
      provider: 'Anthropic',
      version: 'latest',
      contextWindow: 100000
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
    generateCompletion: jest.fn().mockImplementation(async (prompt: string) => {
      return {
        text: `Anthropic response for: ${prompt}`,
        tokens: {
          prompt: Math.ceil(prompt.length / 4),
          completion: 60,
          total: Math.ceil(prompt.length / 4) + 60
        },
        model: modelId,
        processingTime: 2.0
      } as ModelResponse;
    }),
    countTokens: (text: string) => Math.ceil(text.length / 4)
  }))
}));

// Mock Redis for caching
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK')
    };
  });
});

// Spy on the preprocessor, classifier, routing engine, and normalization engine
jest.mock('../../src/services/preprocessor/index.js', () => {
  const originalModule = jest.requireActual('../../src/services/preprocessor/index.js') as any;
  return {
    ...originalModule,
    createPreprocessorService: jest.fn(() => {
      const service = originalModule.createPreprocessorService();
      service.process = jest.fn(service.process);
      return service;
    })
  };
});

jest.mock('../../src/services/classifier/index.js', () => {
  const originalModule = jest.requireActual('../../src/services/classifier/index.js') as any;
  return {
    ...originalModule,
    default: jest.fn((fastify: any) => {
      const service = originalModule.default(fastify);
      service.classifyPrompt = jest.fn(service.classifyPrompt);
      return service;
    })
  };
});

jest.mock('../../src/services/router/routing/index.js', () => {
  const originalModule = jest.requireActual('../../src/services/router/routing/index.js') as any;
  return {
    ...originalModule,
    createRoutingEngine: jest.fn(() => {
      const engine = originalModule.createRoutingEngine();
      engine.route = jest.fn(engine.route);
      return engine;
    })
  };
});

jest.mock('../../src/services/router/normalization/index.js', () => {
  const originalModule = jest.requireActual('../../src/services/router/normalization/index.js') as any;
  return {
    ...originalModule,
    createNormalizationEngine: jest.fn(() => {
      const engine = originalModule.createNormalizationEngine();
      engine.normalize = jest.fn(engine.normalize);
      return engine;
    })
  };
});

describe('Flow Architecture End-to-End Tests', () => {
  let app: FastifyInstance;
  let preprocessorSpy: any;
  let classifierSpy: any;
  let routingEngineSpy: any;
  let normalizationEngineSpy: any;

  beforeEach(async () => {
    // Build the app with mocked dependencies
    app = await build({
      // Mock environment variables
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        HOST: 'localhost',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute_test',
        REDIS_URL: 'redis://localhost:6379/1',
        OPENAI_API_KEY: 'test-openai-key',
        ANTHROPIC_API_KEY: 'test-anthropic-key',
        ENABLE_CACHE: 'true',
        CACHE_TTL: '300',
        ENABLE_DYNAMIC_CONFIG: 'true',
        JWT_SECRET: 'test-jwt-secret',
        COST_OPTIMIZE: 'false',
        QUALITY_OPTIMIZE: 'true',
        LATENCY_OPTIMIZE: 'false',
        FALLBACK_ENABLED: 'true',
        CHAIN_ENABLED: 'false',
        CACHE_STRATEGY: 'default'
      },
      // Mock database
      prisma: {
        config: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({})
        }
      }
    });

    // Get the spy instances
    preprocessorSpy = (app as any).preprocessor.process;
    classifierSpy = (app as any).classifier.classifyPrompt;
    routingEngineSpy = (app as any).router.routing.route;
    normalizationEngineSpy = (app as any).router.normalization.normalize;
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('Basic Flow Tests', () => {
    it('should process a simple prompt through the complete flow', async () => {
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify the response structure
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('model_used');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('processing_time');
      expect(result).toHaveProperty('classification');
      expect(result).toHaveProperty('request_id');
      
      // Verify that all components were called
      expect(preprocessorSpy).toHaveBeenCalledTimes(1);
      expect(classifierSpy).toHaveBeenCalledTimes(1);
      expect(routingEngineSpy).toHaveBeenCalledTimes(1);
      expect(normalizationEngineSpy).toHaveBeenCalledTimes(1);
      
      // Verify the flow sequence
      const preprocessorCallOrder = preprocessorSpy.mock.invocationCallOrder[0];
      const classifierCallOrder = classifierSpy.mock.invocationCallOrder[0];
      const routingCallOrder = routingEngineSpy.mock.invocationCallOrder[0];
      const normalizationCallOrder = normalizationEngineSpy.mock.invocationCallOrder[0];
      
      expect(preprocessorCallOrder).toBeLessThan(classifierCallOrder);
      expect(classifierCallOrder).toBeLessThan(routingCallOrder);
      expect(routingCallOrder).toBeLessThan(normalizationCallOrder);
      
      // Verify that the preprocessed prompt was passed to the classifier
      const preprocessedPrompt = preprocessorSpy.mock.results[0].value;
      expect(classifierSpy).toHaveBeenCalledWith(preprocessedPrompt, undefined);
      
      // Verify that the classification was passed to the routing engine
      const classification = classifierSpy.mock.results[0].value;
      expect(routingEngineSpy).toHaveBeenCalledWith(preprocessedPrompt, classification, expect.any(Object));
      
      // Verify that the routing result was used for normalization
      const routingResult = routingEngineSpy.mock.results[0].value;
      expect(normalizationEngineSpy).toHaveBeenCalledWith(preprocessedPrompt, routingResult.modelId, expect.any(Object));
      
      // Verify that the processing times were recorded
      expect(result.processing_time).toHaveProperty('preprocessing');
      expect(result.processing_time).toHaveProperty('classification');
      expect(result.processing_time).toHaveProperty('routing');
      expect(result.processing_time).toHaveProperty('normalization');
      expect(result.processing_time).toHaveProperty('model_generation');
      expect(result.processing_time).toHaveProperty('total');
    });

    it('should respect model_id override when provided', async () => {
      // Make a request to the prompt endpoint with a specific model
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          model_id: 'claude-3-7-sonnet-latest'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify that the specified model was used
      expect(result.model_used).toBe('claude-3-7-sonnet-latest');
      expect(result.response).toContain('Anthropic response for:');
    });
  });

  describe('Complex Flow Tests', () => {
    it('should handle complex prompts with specific classification', async () => {
      // Mock the classifier to return a complex classification
      const complexClassification: ClassifiedIntent = {
        type: 'code',
        complexity: 'complex',
        features: ['code-generation', 'reasoning', 'knowledge-retrieval'],
        priority: 'high',
        confidence: 0.95,
        tokens: {
          estimated: 500,
          completion: 1000
        },
        domain: 'programming',
        language: 'typescript'
      };
      
      classifierSpy.mockResolvedValueOnce(complexClassification);
      
      // Make a request with a complex prompt
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Write a TypeScript function that implements a binary search tree with insertion, deletion, and traversal methods.'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify the classification in the response
      expect(result.classification).toEqual({
        intent: 'code',
        confidence: 0.95,
        features: ['code-generation', 'reasoning', 'knowledge-retrieval'],
        domain: 'programming'
      });
      
      // Verify that the routing engine received the complex classification
      expect(routingEngineSpy).toHaveBeenCalledWith(
        expect.any(String),
        complexClassification,
        expect.any(Object)
      );
    });

    it('should apply routing options when provided', async () => {
      // Make a request with routing options
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          routingOptions: {
            costOptimize: true,
            qualityOptimize: false,
            latencyOptimize: true
          }
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      
      // Verify that the routing options were passed to the routing engine
      expect(routingEngineSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          costOptimize: true,
          qualityOptimize: false,
          latencyOptimize: true
        })
      );
    });

    it('should apply normalization options when provided', async () => {
      // Make a request with normalization options
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          normalizationOptions: {
            formatForModel: true,
            preserveFormatting: false
          }
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      
      // Verify that the normalization options were passed to the normalization engine
      expect(normalizationEngineSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          formatForModel: true,
          preserveFormatting: false
        })
      );
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle preprocessor errors gracefully', async () => {
      // Make the preprocessor throw an error
      preprocessorSpy.mockRejectedValueOnce(new Error('Preprocessor error'));
      
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Preprocessor error');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('request_id');
    });

    it('should handle classifier errors gracefully', async () => {
      // Make the classifier throw an error
      classifierSpy.mockRejectedValueOnce(new Error('Classifier error'));
      
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Classifier error');
    });

    it('should handle routing engine errors gracefully', async () => {
      // Make the routing engine throw an error
      routingEngineSpy.mockRejectedValueOnce(new Error('Routing error'));
      
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Routing error');
    });

    it('should handle normalization engine errors gracefully', async () => {
      // Make the normalization engine throw an error
      normalizationEngineSpy.mockRejectedValueOnce(new Error('Normalization error'));
      
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Normalization error');
    });

    it('should handle invalid input gracefully', async () => {
      // Make a request with an empty prompt
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: ''
        }
      });

      // Check the response
      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Prompt is required');
    });
  });

  describe('Performance Tests', () => {
    it('should record processing times for each stage', async () => {
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify that all processing times are recorded
      expect(result.processing_time).toHaveProperty('preprocessing');
      expect(result.processing_time).toHaveProperty('classification');
      expect(result.processing_time).toHaveProperty('routing');
      expect(result.processing_time).toHaveProperty('normalization');
      expect(result.processing_time).toHaveProperty('model_generation');
      expect(result.processing_time).toHaveProperty('total');
      
      // Verify that the total time is the sum of all individual times (with some margin for overhead)
      const individualTimes = 
        result.processing_time.preprocessing +
        result.processing_time.classification +
        result.processing_time.routing +
        result.processing_time.normalization +
        result.processing_time.model_generation;
      
      expect(result.processing_time.total).toBeGreaterThanOrEqual(individualTimes);
      // Allow for some overhead in the total time
      expect(result.processing_time.total).toBeLessThan(individualTimes + 100);
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      // Make multiple concurrent requests
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(app.inject({
          method: 'POST',
          url: '/prompt',
          payload: {
            prompt: `Tell me about topic ${i}`
          }
        }));
      }
      
      // Wait for all requests to complete
      const responses = await Promise.all(promises);
      
      // Check that all responses were successful
      for (const response of responses) {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result).toHaveProperty('response');
        expect(result).toHaveProperty('processing_time');
      }
      
      // Verify that all components were called the correct number of times
      expect(preprocessorSpy).toHaveBeenCalledTimes(5);
      expect(classifierSpy).toHaveBeenCalledTimes(5);
      expect(routingEngineSpy).toHaveBeenCalledTimes(5);
      expect(normalizationEngineSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('Backward Compatibility Tests', () => {
    it('should maintain backward compatibility with existing client requests', async () => {
      // Make a request in the old format (without routingOptions, normalizationOptions)
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          model: 'gpt-4', // Old parameter name
          max_tokens: 1000,
          temperature: 0.7
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify the response structure matches the expected format
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('model_used');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('processing_time');
    });
  });
});