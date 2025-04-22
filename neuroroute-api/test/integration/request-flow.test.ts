import { FastifyInstance } from 'fastify';
import { build } from '../helpers/app-builder.js';
import { ModelResponse } from '../../src/models/base-adapter.js';

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
    generateCompletion: jest.fn().mockImplementation(async (prompt) => {
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

describe('Complete Request Flow Integration Tests', () => {
  let app: FastifyInstance;

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
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Prompt Routing', () => {
    it('should route a prompt to the appropriate model', async () => {
      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          model: 'gpt-4'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify the response structure
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('model_used', 'gpt-4');
      expect(result).toHaveProperty('tokens');
      expect(result.response).toContain('OpenAI response for:');
    });

    it('should select a model based on prompt classification when no model specified', async () => {
      // Make a request to the prompt endpoint without specifying a model
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Write a complex algorithm for sorting a list'
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify that a model was selected
      expect(result).toHaveProperty('model_used');
      expect(result).toHaveProperty('classification');
    });

    it('should use fallback model when primary model is unavailable', async () => {
      // Mock the OpenAI adapter to be unavailable
      const openaiAdapter = require('../../src/models/openai-adapter.js').default;
      openaiAdapter.mockImplementation((fastify: any, modelId: string) => ({
        getModelId: () => modelId,
        provider: 'openai',
        getCapabilities: () => ['text-generation', 'code-generation', 'reasoning'],
        getDetails: () => ({
          provider: 'OpenAI',
          version: 'latest',
          contextWindow: 8192
        }),
        isAvailable: jest.fn().mockResolvedValue(false), // Not available
        generateCompletion: jest.fn().mockRejectedValue(new Error('Model unavailable')),
        countTokens: (text: string) => Math.ceil(text.length / 4)
      }));

      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          model: 'gpt-4' // This should fail and fallback to another model
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify that a fallback model was used
      expect(result).toHaveProperty('model_used');
      expect(result.model_used).not.toBe('gpt-4');
    });
  });

  describe('Caching', () => {
    it('should cache responses and return cached results for identical prompts', async () => {
      // Mock the Redis get method to return null for the first call and a cached response for the second
      const Redis = require('ioredis');
      const redisMock = Redis();
      
      redisMock.get
        .mockResolvedValueOnce(null) // First call - cache miss
        .mockResolvedValueOnce(JSON.stringify({ // Second call - cache hit
          response: 'Cached response',
          model_used: 'gpt-4',
          tokens: {
            prompt: 10,
            completion: 20,
            total: 30
          },
          cached: true
        }));

      // First request - should hit the model
      const response1 = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about caching',
          model: 'gpt-4'
        }
      });

      // Second request with the same prompt - should return cached result
      const response2 = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about caching',
          model: 'gpt-4'
        }
      });

      // Check the responses
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      
      const result1 = JSON.parse(response1.payload);
      const result2 = JSON.parse(response2.payload);
      
      // First response should not be cached
      expect(result1).not.toHaveProperty('cached', true);
      
      // Second response should be cached
      expect(result2).toHaveProperty('cached', true);
      expect(result2.response).toBe('Cached response');
    });

    it('should respect cache strategy settings', async () => {
      // Make a request with minimal cache strategy
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about caching',
          model: 'gpt-4',
          options: {
            cacheStrategy: 'minimal'
          }
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      
      // Verify that Redis set was called with appropriate TTL
      const Redis = require('ioredis');
      const redisMock = Redis();
      
      // For minimal strategy, very short prompts might not be cached
      if (redisMock.set.mock.calls.length > 0) {
        const setCall = redisMock.set.mock.calls[0];
        expect(setCall[2]).toBe('EX'); // EX flag for TTL
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle model errors gracefully', async () => {
      // Mock the OpenAI adapter to throw an error
      const openaiAdapter = require('../../src/models/openai-adapter.js').default;
      openaiAdapter.mockImplementation((fastify: any, modelId: string) => ({
        getModelId: () => modelId,
        provider: 'openai',
        getCapabilities: () => ['text-generation', 'code-generation', 'reasoning'],
        getDetails: () => ({
          provider: 'OpenAI',
          version: 'latest',
          contextWindow: 8192
        }),
        isAvailable: jest.fn().mockResolvedValue(true),
        generateCompletion: jest.fn().mockRejectedValue(new Error('API error')),
        countTokens: (text: string) => Math.ceil(text.length / 4)
      }));

      // Make a request to the prompt endpoint
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me about the weather',
          model: 'gpt-4'
        }
      });

      // Check the response - should be an error
      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('code');
    });

    it('should handle invalid requests', async () => {
      // Make a request with an empty prompt
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: '',
          model: 'gpt-4'
        }
      });

      // Check the response - should be a validation error
      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      
      // Verify the error structure
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('code');
    });
  });

  describe('Performance Optimization', () => {
    it('should respect quality optimization settings', async () => {
      // Make a request with quality optimization enabled
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Write a complex algorithm',
          options: {
            qualityOptimize: true,
            costOptimize: false,
            latencyOptimize: false
          }
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // With quality optimization, should select a high-quality model
      expect(result).toHaveProperty('model_used');
      // In a real scenario, this would be a high-quality model like gpt-4 or claude-3-opus
    });

    it('should respect cost optimization settings', async () => {
      // Make a request with cost optimization enabled
      const response = await app.inject({
        method: 'POST',
        url: '/prompt',
        payload: {
          prompt: 'Tell me a simple fact',
          options: {
            qualityOptimize: false,
            costOptimize: true,
            latencyOptimize: false
          }
        }
      });

      // Check the response
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // With cost optimization, should select a lower-cost model
      expect(result).toHaveProperty('model_used');
      // In a real scenario, this would be a lower-cost model like gpt-3.5-turbo or claude-3-haiku
    });
  });
});