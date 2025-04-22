import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import createOpenAIAdapter from '../../src/models/openai-adapter.js';
import { BaseModelAdapter } from '../../src/models/base-adapter.js';
import { ErrorType } from '../../src/utils/error-handler.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenAI Adapter Enhanced Tests', () => {
  let app: FastifyInstance;
  let adapter: BaseModelAdapter;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config
    app.decorate('config', {
      OPENAI_API_KEY: 'test-api-key',
      PORT: 3000,
      HOST: 'localhost',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute_test',
      REDIS_URL: 'redis://localhost:6379',
      REDIS_CACHE_TTL: 300,
      JWT_SECRET: 'test-secret',
      JWT_EXPIRATION: '1h',
      LOG_LEVEL: 'info',
      API_RATE_LIMIT: 200,
      API_TIMEOUT: 30000,
      ENABLE_CACHE: true,
      ENABLE_SWAGGER: true,
      ENABLE_JWT_AUTH: true,
      ENABLE_DYNAMIC_CONFIG: true,
      ENABLE_METRICS: true,
      ENABLE_TRACING: false,
      COST_OPTIMIZE: false,
      QUALITY_OPTIMIZE: true,
      LATENCY_OPTIMIZE: false,
      FALLBACK_ENABLED: true,
      CHAIN_ENABLED: false,
      CACHE_STRATEGY: 'default'
    } as unknown as AppConfig);

    // Mock Redis for circuit breaker tests
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK')
    };
    
    app.decorate('redis', {
      getter: () => redisMock
    });

    // Create adapter
    adapter = createOpenAIAdapter(app, 'gpt-4');
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the correct model ID', () => {
      expect(adapter.getModelId()).toBe('gpt-4');
    });

    it('should set capabilities based on model ID', () => {
      // GPT-4 should have code-generation and reasoning capabilities
      expect(adapter.getCapabilities()).toContain('text-generation');
      expect(adapter.getCapabilities()).toContain('code-generation');
      expect(adapter.getCapabilities()).toContain('reasoning');

      // Create adapter with different model
      const otherAdapter = createOpenAIAdapter(app, 'gpt-3.5-turbo');
      
      // Should still have text-generation but might not have other capabilities
      expect(otherAdapter.getCapabilities()).toContain('text-generation');
    });

    it('should set model details with correct context window', () => {
      // GPT-4 should have 8192 context window
      const details = adapter.getDetails();
      expect(details.contextWindow).toBe(8192);

      // GPT-3.5 should have 4096 context window
      const otherAdapter = createOpenAIAdapter(app, 'gpt-3.5-turbo');
      const otherDetails = otherAdapter.getDetails();
      expect(otherDetails.contextWindow).toBe(4096);
    });
  });

  describe('loadApiKey', () => {
    it('should load API key from config manager if available', async () => {
      // Mock config manager
      app.decorate('configManager', {
        getApiKey: jest.fn().mockResolvedValue('config-manager-api-key')
      });

      // Create new adapter to trigger loadApiKey
      const newAdapter = createOpenAIAdapter(app, 'gpt-4');
      
      // Force loadApiKey to complete
      await (newAdapter as unknown as { loadApiKey: () => Promise<void> }).loadApiKey();
      
      // Check if configManager.getApiKey was called
      expect(app.configManager.getApiKey).toHaveBeenCalledWith('openai');
      
      // Check if API key was set correctly
      expect((newAdapter as unknown as { apiKey: string }).apiKey).toBe('config-manager-api-key');
    });

    it('should fall back to environment variable if config manager fails', async () => {
      // Mock config manager that throws an error
      app.decorate('configManager', {
        getApiKey: jest.fn().mockRejectedValue(new Error('Config manager error'))
      });

      // Create new adapter to trigger loadApiKey
      const newAdapter = createOpenAIAdapter(app, 'gpt-4');
      
      // Force loadApiKey to complete
      await (newAdapter as unknown as { loadApiKey: () => Promise<void> }).loadApiKey();
      
      // Check if API key was set from environment variable
      expect((newAdapter as unknown as { apiKey: string }).apiKey).toBe('test-api-key');
    });
  });

  describe('isAvailable', () => {
    it('should return true if API key is available', async () => {
      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false if API key is not available', async () => {
      // Create app without API key
      const appWithoutKey = Fastify({ logger: false });
      appWithoutKey.decorate('config', {} as Record<string, unknown>);
      
      // Create adapter
      const adapterWithoutKey = createOpenAIAdapter(appWithoutKey, 'gpt-4');
      
      const result = await adapterWithoutKey.isAvailable();
      expect(result).toBe(false);
      
      await appWithoutKey.close();
    });

    it('should try to load API key if not already loaded', async () => {
      // Create adapter with spy on loadApiKey
      const newAdapter = createOpenAIAdapter(app, 'gpt-4');
      const loadApiKeySpy = jest.spyOn(newAdapter as unknown as { loadApiKey: () => Promise<void> }, 'loadApiKey');
      
      // Set apiKey to empty to force loadApiKey call
      (newAdapter as unknown as { apiKey: string }).apiKey = '';
      
      await newAdapter.isAvailable();
      
      expect(loadApiKeySpy).toHaveBeenCalled();
    });
  });

  describe('generateCompletion', () => {
    it('should generate a completion successfully', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a test response'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Call the method
      const result = await adapter.generateCompletion('Test prompt', { maxTokens: 100 });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      expect(result).toHaveProperty('tokens.prompt', 10);
      expect(result).toHaveProperty('tokens.completion', 20);
      expect(result).toHaveProperty('tokens.total', 30);
      expect(result).toHaveProperty('model', 'gpt-4');
      expect(result).toHaveProperty('processingTime');
      
      // Verify the API call
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test prompt' }],
        max_tokens: 100
      }));
      expect(postCall[2]).toEqual(expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        }
      }));
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockedAxios.post.mockRejectedValue(new Error('API error'));
      
      // Call the method and expect it to throw
      await expect(adapter.generateCompletion('Test prompt')).rejects.toThrow();
    });

    it('should throw an error if API key is not configured', async () => {
      // Create app without API key
      const appWithoutKey = Fastify({ logger: false });
      appWithoutKey.decorate('config', {} as Record<string, unknown>);
      
      // Create adapter
      const adapterWithoutKey = createOpenAIAdapter(appWithoutKey, 'gpt-4');
      
      // Call the method and expect it to throw
      await expect(adapterWithoutKey.generateCompletion('Test prompt')).rejects.toThrow();
      
      await appWithoutKey.close();
    });

    it('should retry on retryable errors', async () => {
      // Mock API error that should be retried
      const retryableError = {
        message: 'ECONNRESET',
        response: {
          status: 503,
          data: {
            error: {
              message: 'Service unavailable'
            }
          }
        }
      };
      
      // First call fails, second call succeeds
      mockedAxios.post
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({
          data: {
            id: 'test-id',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'This is a test response after retry'
                },
                index: 0,
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30
            }
          }
        });
      
      // Call the method with retry options
      const result = await adapter.generateCompletion('Test prompt', {
        maxRetries: 1,
        initialBackoff: 10 // Small backoff for tests
      });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response after retry');
      
      // Verify that axios.post was called twice
      expect(mockedAxios.post.mock.calls.length).toBe(2);
    });

    it('should respect maxRetries option', async () => {
      // Mock API error that should be retried
      const retryableError = {
        message: 'ECONNRESET',
        response: {
          status: 503,
          data: {
            error: {
              message: 'Service unavailable'
            }
          }
        }
      };
      
      // All calls fail
      mockedAxios.post
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError);
      
      // Call the method with retry options
      await expect(adapter.generateCompletion('Test prompt', {
        maxRetries: 2,
        initialBackoff: 10 // Small backoff for tests
      })).rejects.toThrow();
      
      // Verify that axios.post was called exactly 3 times (initial + 2 retries)
      expect(mockedAxios.post.mock.calls.length).toBe(3);
    });
  });

  describe('circuit breaker', () => {
    it('should check circuit breaker state before making request', async () => {
      // Spy on getCircuitBreakerState
      const adapterWithPrivate = adapter as unknown as { 
        getCircuitBreakerState: (key: string) => Promise<string> 
      };
      const getCircuitBreakerStateSpy = jest.spyOn(adapterWithPrivate, 'getCircuitBreakerState');
      
      // Mock successful API response
      mockedAxios.post.mockResolvedValue({
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a test response'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        }
      });
      
      // Call the method
      await adapter.generateCompletion('Test prompt');
      
      // Verify that getCircuitBreakerState was called
      expect(getCircuitBreakerStateSpy).toHaveBeenCalled();
    });

    it('should fail fast if circuit breaker is open', async () => {
      // Mock circuit breaker state as open
      const redisMock = app.redis as unknown as { get: jest.Mock };
      redisMock.get.mockResolvedValue(JSON.stringify({
        status: 'open',
        timestamp: Date.now()
      }));
      
      // Call the method and expect it to throw without calling axios
      await expect(adapter.generateCompletion('Test prompt')).rejects.toThrow(/circuit breaker open/i);
      
      // Verify that axios.post was not called
      expect(mockedAxios.post.mock.calls.length).toBe(0);
    });

    it('should trip circuit breaker on non-retryable errors', async () => {
      // Spy on tripCircuitBreaker
      const adapterWithPrivate = adapter as unknown as { 
        tripCircuitBreaker: (key: string) => Promise<void> 
      };
      const tripCircuitBreakerSpy = jest.spyOn(adapterWithPrivate, 'tripCircuitBreaker');
      
      // Mock API error that should trip circuit breaker
      const nonRetryableError = {
        message: 'Authentication error',
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid API key'
            }
          }
        }
      };
      
      mockedAxios.post.mockRejectedValue(nonRetryableError);
      
      // Call the method and expect it to throw
      await expect(adapter.generateCompletion('Test prompt')).rejects.toThrow();
      
      // Verify that tripCircuitBreaker was called
      expect(tripCircuitBreakerSpy).toHaveBeenCalled();
    });

    it('should reset circuit breaker on successful request after half-open state', async () => {
      // Spy on resetCircuitBreaker
      const adapterWithPrivate = adapter as unknown as { 
        resetCircuitBreaker: (key: string) => Promise<void> 
      };
      const resetCircuitBreakerSpy = jest.spyOn(adapterWithPrivate, 'resetCircuitBreaker');
      
      // Mock circuit breaker state as half-open
      const redisMock = app.redis as unknown as { get: jest.Mock };
      redisMock.get.mockResolvedValue(JSON.stringify({
        status: 'half-open',
        timestamp: Date.now()
      }));
      
      // Mock successful API response
      mockedAxios.post.mockResolvedValue({
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a test response'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        }
      });
      
      // Call the method
      await adapter.generateCompletion('Test prompt');
      
      // Verify that resetCircuitBreaker was called
      expect(resetCircuitBreakerSpy).toHaveBeenCalled();
    });
  });

  describe('generateCompletionStream', () => {
    it('should generate a streaming completion successfully', async () => {
      // Mock successful API response for streaming
      const mockResponse = {
        data: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              // Simulate data events
              callback(Buffer.from(JSON.stringify({
                choices: [{ delta: { content: 'chunk1' } }]
              })));
              callback(Buffer.from(JSON.stringify({
                choices: [{ delta: { content: 'chunk2' } }]
              })));
            } else if (event === 'end') {
              // Simulate end event
              callback();
            }
            return { on: jest.fn() }; // For chaining
          })
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Call the method
      const adapterWithStream = adapter as unknown as { 
        generateCompletionStream: (prompt: string) => AsyncGenerator<any, void, unknown> 
      };
      const generator = adapterWithStream.generateCompletionStream('Test prompt');
      
      // Collect chunks
      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
      
      // Verify the chunks
      expect(chunks.length).toBe(3); // 2 data chunks + 1 done chunk
      expect(chunks[0].chunk).toBe('chunk1');
      expect(chunks[1].chunk).toBe('chunk2');
      expect(chunks[2].done).toBe(true);
      
      // Verify the API call
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test prompt' }],
        stream: true
      }));
      expect(postCall[2]).toEqual(expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        responseType: 'stream'
      }));
    });

    it('should handle streaming errors gracefully', async () => {
      // Mock API error
      mockedAxios.post.mockRejectedValue(new Error('API error'));
      
      // Call the method
      const adapterWithStream = adapter as unknown as { 
        generateCompletionStream: (prompt: string) => AsyncGenerator<any, void, unknown> 
      };
      const generator = adapterWithStream.generateCompletionStream('Test prompt');
      
      // Collect chunks
      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
      
      // Verify that an error chunk was returned
      expect(chunks.length).toBe(1);
      expect(chunks[0].error).toBe(true);
      expect(chunks[0].done).toBe(true);
    });
  });

  describe('countTokens', () => {
    it('should estimate token count based on text length', () => {
      const text = 'This is a test text with approximately 10 tokens.';
      const tokenCount = adapter.countTokens(text);
      
      // Simple approximation: 1 token ≈ 4 characters
      const expectedCount = Math.ceil(text.length / 4);
      expect(tokenCount).toBe(expectedCount);
    });
  });

  describe('error classification', () => {
    it('should classify rate limit errors correctly', async () => {
      // Mock rate limit error
      const rateLimitError = {
        message: 'Rate limit exceeded',
        response: {
          status: 429,
          data: {
            error: {
              message: 'Rate limit exceeded',
              type: 'rate_limit_exceeded'
            }
          }
        }
      };
      
      mockedAxios.post.mockRejectedValue(rateLimitError);
      
      // Call the method and expect it to throw a rate limit error
      try {
        await adapter.generateCompletion('Test prompt');
        fail('Should have thrown an error');
      } catch (error) {
        // Type assertion for error
        const modelError = error as { code: string; statusCode: number };
        expect(modelError.code).toBe(ErrorType.MODEL_RATE_LIMITED);
        expect(modelError.statusCode).toBe(429);
      }
    });

    it('should classify authentication errors correctly', async () => {
      // Mock authentication error
      const authError = {
        message: 'Authentication error',
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid API key',
              type: 'invalid_request_error'
            }
          }
        }
      };
      
      mockedAxios.post.mockRejectedValue(authError);
      
      // Call the method and expect it to throw an authentication error
      try {
        await adapter.generateCompletion('Test prompt');
        fail('Should have thrown an error');
      } catch (error) {
        // Type assertion for error
        const modelError = error as { code: string; statusCode: number };
        expect(modelError.code).toBe(ErrorType.MODEL_AUTHENTICATION);
        expect(modelError.statusCode).toBe(401);
      }
    });

    it('should classify content filter errors correctly', async () => {
      // Mock content filter error
      const contentFilterError = {
        message: 'Content filter',
        response: {
          status: 400,
          data: {
            error: {
              message: 'Your request was rejected as a result of our safety system',
              type: 'content_filter'
            }
          }
        }
      };
      
      mockedAxios.post.mockRejectedValue(contentFilterError);
      
      // Call the method and expect it to throw a content filter error
      try {
        await adapter.generateCompletion('Test prompt');
        fail('Should have thrown an error');
      } catch (error) {
        // Type assertion for error
        const modelError = error as { code: string };
        expect(modelError.code).toBe(ErrorType.MODEL_CONTENT_FILTERED);
      }
    });
  });
});