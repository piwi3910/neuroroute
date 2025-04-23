import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import createLMStudioAdapter, { LMStudioAdapter, LMStudioRequestOptions } from '../../src/models/lmstudio-adapter.js';
import { BaseModelAdapter, ChatMessage, FunctionDefinition, ToolDefinition, StreamingChunk } from '../../src/models/base-adapter.js';
import { getModelAdapter } from '../../src/models/adapter-registry.js';

// Mock the adapter registry module
jest.mock('../../src/models/adapter-registry', () => ({
  getModelAdapter: jest.fn()
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Integration tests for the enhanced LMStudio adapter
 * 
 * These tests verify the interactions between the LMStudio adapter and other components
 * of the system, focusing on the new features added to support the LMStudio API.
 */
describe('LMStudio Adapter Integration Tests', () => {
  let app: FastifyInstance;
  let adapter: BaseModelAdapter;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config
    app.decorate('config', {
      LMSTUDIO_URL: 'http://localhost:1234/v1',
      LMSTUDIO_TIMEOUT: 60000,
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
    } as any);

    // Mock Redis for circuit breaker tests
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK')
    };
    
    // Use type assertion to bypass type checking for tests
    app.decorate('redis', redisMock as any);

    // Create adapter
    adapter = createLMStudioAdapter(app, 'llama3');

    // Set up the mock for getModelAdapter
    (getModelAdapter as jest.Mock).mockReturnValue(adapter);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

/**
   * Test 1: Basic Functionality
   * Verify that the basic functionality of the LMStudio adapter still works with the original API.
   */
  describe('Basic Functionality', () => {
    it('should generate a completion using the original API', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
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
      expect(result).toHaveProperty('model', 'llama3');
      expect(result).toHaveProperty('processingTime');
      
      // Verify the API call
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('http://localhost:1234/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        model: 'llama3',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Test prompt' }
        ],
        max_tokens: 100
      }));
    });

    it('should be accessible through the adapter registry', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
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
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call the method
      const result = await registryAdapter.generateCompletion('Test prompt', { maxTokens: 100 });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      expect(result).toHaveProperty('model', 'llama3');
    });
  });

  /**
   * Test 2: Conversation History
   * Test multi-turn conversations with message history.
   */
  describe('Conversation History', () => {
    it('should maintain conversation history across multiple turns', async () => {
      // Mock first API response
      const mockResponse1 = {
        data: {
          id: 'test-id-1',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you today?'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 10,
            total_tokens: 20
          }
        }
      };
      
      // Mock second API response
      const mockResponse2 = {
        data: {
          id: 'test-id-2',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Paris is the capital of France.'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 10,
            total_tokens: 40
          }
        }
      };
      
      mockedAxios.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // First turn
      const result1 = await registryAdapter.generateCompletion('Hello', {
        systemMessage: 'You are a helpful assistant.'
      } as LMStudioRequestOptions);
      
      // Verify first response
      expect(result1).toHaveProperty('text', 'Hello! How can I help you today?');
      expect(result1.messages).toHaveLength(3); // system, user, assistant
      
      // Second turn - use the conversation history from the first turn
      const result2 = await registryAdapter.generateCompletion('What is the capital of France?', {
        messages: result1.messages
      } as LMStudioRequestOptions);
      
      // Verify second response
      expect(result2).toHaveProperty('text', 'Paris is the capital of France.');
      expect(result2.messages).toHaveLength(5); // system, user, assistant, user, assistant
      
      // Verify the API call for the second turn included the full conversation history
      const secondPostCall = mockedAxios.post.mock.calls[1];
      expect(secondPostCall[1]).toHaveProperty('messages');
      const conversationMessages = (secondPostCall[1] as any).messages as ChatMessage[];
      expect(conversationMessages).toHaveLength(4); // The 4 messages before the new response
      expect(conversationMessages[0]).toHaveProperty('role', 'system');
      expect(conversationMessages[1]).toHaveProperty('role', 'user');
      expect(conversationMessages[1]).toHaveProperty('content', 'Hello');
      expect(conversationMessages[2]).toHaveProperty('role', 'assistant');
      expect(conversationMessages[2]).toHaveProperty('content', 'Hello! How can I help you today?');
      expect(conversationMessages[3]).toHaveProperty('role', 'user');
      expect(conversationMessages[3]).toHaveProperty('content', 'What is the capital of France?');
    });
  });

/**
   * Test 3: Function Calling
   * Test the function calling capabilities.
   */
  describe('Function Calling', () => {
    it('should support function calling and function responses', async () => {
      // Mock first API response with function call
      const mockResponse1 = {
        data: {
          id: 'test-id-1',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                function_call: {
                  name: 'get_weather',
                  arguments: '{"location":"New York","unit":"celsius"}'
                }
              },
              index: 0,
              finish_reason: 'function_call'
            }
          ],
          usage: {
            prompt_tokens: 25,
            completion_tokens: 15,
            total_tokens: 40
          }
        }
      };
      
      // Mock second API response after function call
      const mockResponse2 = {
        data: {
          id: 'test-id-2',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'The weather in New York is currently 22°C and sunny.'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 40,
            completion_tokens: 20,
            total_tokens: 60
          }
        }
      };
      
      mockedAxios.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      
      // Define function definition
      const functions: FunctionDefinition[] = [
        {
          name: 'get_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The temperature unit to use'
              }
            },
            required: ['location']
          }
        }
      ];
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // First call with function definition
      const result1 = await registryAdapter.generateCompletion(
        'What is the weather in New York?',
        {
          functions: functions,
          functionCall: 'auto'
        } as LMStudioRequestOptions
      );
      
      // Verify function call in response
      expect(result1).toHaveProperty('functionCall');
      expect(result1.functionCall).toHaveProperty('name', 'get_weather');
      expect(result1.functionCall).toHaveProperty('arguments', '{"location":"New York","unit":"celsius"}');
      
      // Simulate function execution and continue conversation
      const functionResult = JSON.stringify({
        location: 'New York',
        temperature: 22,
        unit: 'celsius',
        condition: 'sunny'
      });
      
      // Continue conversation with function result
      const functionMessages = [
        ...(result1.messages || []),
        {
          role: 'function',
          name: 'get_weather',
          content: functionResult
        }
      ];
      
      // Second call with function result
      const result2 = await registryAdapter.generateCompletion('', {
        messages: functionMessages
      } as LMStudioRequestOptions);
      
      // Verify response after function call
      expect(result2).toHaveProperty('text', 'The weather in New York is currently 22°C and sunny.');
      
      // Verify the API calls
      const firstPostCall = mockedAxios.post.mock.calls[0];
      expect(firstPostCall[1]).toEqual(expect.objectContaining({
        functions: functions,
        function_call: 'auto'
      }));
      
      const secondPostCall = mockedAxios.post.mock.calls[1];
      expect(secondPostCall[1]).toHaveProperty('messages');
      const functionResponseMessages = (secondPostCall[1] as any).messages as ChatMessage[];
      expect(functionResponseMessages).toContainEqual(
        expect.objectContaining({
          role: 'function',
          name: 'get_weather',
          content: functionResult
        })
      );
    });
  });

  /**
   * Test 4: Tool Usage
   * Test the tool usage capabilities.
   */
  describe('Tool Usage', () => {
    it('should support tool calling and tool responses', async () => {
      // Mock first API response with tool call
      const mockResponse1 = {
        data: {
          id: 'test-id-1',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc123',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location":"Tokyo","unit":"celsius"}'
                    }
                  }
                ]
              },
              index: 0,
              finish_reason: 'tool_calls'
            }
          ],
          usage: {
            prompt_tokens: 25,
            completion_tokens: 15,
            total_tokens: 40
          }
        }
      };
      
      // Mock second API response after tool call
      const mockResponse2 = {
        data: {
          id: 'test-id-2',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'The weather in Tokyo is currently 25°C and partly cloudy.'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 40,
            completion_tokens: 20,
            total_tokens: 60
          }
        }
      };
      
      mockedAxios.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      
      // Define tool definition
      const tools: ToolDefinition[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather in a given location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'The temperature unit to use'
                }
              },
              required: ['location']
            }
          }
        }
      ];
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // First call with tool definition
      const result1 = await registryAdapter.generateCompletion(
        'What is the weather in Tokyo?',
        {
          tools: tools,
          toolChoice: 'auto'
        } as LMStudioRequestOptions
      );
      
      // Verify tool call in response
      expect(result1).toHaveProperty('toolCalls');
      expect(result1.toolCalls).toHaveLength(1);
      expect(result1.toolCalls?.[0]).toHaveProperty('id', 'call_abc123');
      expect(result1.toolCalls?.[0]).toHaveProperty('type', 'function');
      expect(result1.toolCalls?.[0].function).toHaveProperty('name', 'get_weather');
      expect(result1.toolCalls?.[0].function).toHaveProperty('arguments', '{"location":"Tokyo","unit":"celsius"}');
      
      // Simulate tool execution and continue conversation
      const toolResult = JSON.stringify({
        location: 'Tokyo',
        temperature: 25,
        unit: 'celsius',
        condition: 'partly cloudy'
      });
      
      // Continue conversation with tool result
      const toolMessages = [
        ...(result1.messages || []),
        {
          role: 'tool',
          tool_call_id: result1.toolCalls?.[0].id,
          content: toolResult
        }
      ];
      
      // Second call with tool result
      const result2 = await registryAdapter.generateCompletion('', {
        messages: toolMessages
      } as LMStudioRequestOptions);
      
      // Verify response after tool call
      expect(result2).toHaveProperty('text', 'The weather in Tokyo is currently 25°C and partly cloudy.');
      
      // Verify the API calls
      const firstPostCall = mockedAxios.post.mock.calls[0];
      expect(firstPostCall[1]).toEqual(expect.objectContaining({
        tools: tools,
        tool_choice: 'auto'
      }));
      
      const secondPostCall = mockedAxios.post.mock.calls[1];
      expect(secondPostCall[1]).toHaveProperty('messages');
      const toolResponseMessages = (secondPostCall[1] as any).messages as ChatMessage[];
      expect(toolResponseMessages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call_abc123',
          content: toolResult
        })
      );
    });
  });

/**
   * Test 5: Streaming
   * Test the streaming capabilities.
   */
  describe('Streaming', () => {
    it('should support streaming text responses', async () => {
      // Create a mock stream
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n');
          yield Buffer.from('data: {"choices":[{"delta":{"content":" world"},"index":0}]}\n\n');
          yield Buffer.from('data: {"choices":[{"delta":{"content":"!"},"index":0,"finish_reason":"stop"}]}\n\n');
          yield Buffer.from('data: [DONE]\n\n');
        },
      };
      
      // Mock axios post to return the stream
      mockedAxios.post.mockResolvedValueOnce({
        data: mockStream,
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call generateCompletionStream
      const stream = registryAdapter.generateCompletionStream('Test prompt', {
        temperature: 0.7,
        maxTokens: 100
      });
      
      // Collect all chunks
      const chunks: StreamingChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      // Verify the API call
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('http://localhost:1234/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        model: 'llama3',
        stream: true
      }));
      
      // Verify the chunks
      expect(chunks).toHaveLength(4); // 3 content chunks + 1 final empty chunk
      expect(chunks[0].chunk).toBe('Hello');
      expect(chunks[1].chunk).toBe(' world');
      expect(chunks[2].chunk).toBe('!');
      expect(chunks[3].done).toBe(true);
      
      // Combine chunks to verify full response
      const fullText = chunks.map(c => c.chunk).join('');
      expect(fullText).toBe('Hello world!');
    });
    
    it('should support streaming with function calls', async () => {
      // Create a mock stream
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('data: {"choices":[{"delta":{"content":"I\'ll check the weather"},"index":0}]}\n\n');
          yield Buffer.from('data: {"choices":[{"delta":{"function_call":{"name":"get_weather","arguments":"{\\\"location\\\""}}}]}\n\n');
          yield Buffer.from('data: {"choices":[{"delta":{"function_call":{"arguments":":\\\"San Francisco\\\"}"}}}]}\n\n');
          yield Buffer.from('data: {"choices":[{"finish_reason":"function_call","index":0}]}\n\n');
          yield Buffer.from('data: [DONE]\n\n');
        },
      };
      
      // Mock axios post to return the stream
      mockedAxios.post.mockResolvedValueOnce({
        data: mockStream,
      });
      
      // Define function
      const functions: FunctionDefinition[] = [
        {
          name: 'get_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA',
              },
            },
            required: ['location'],
          },
        },
      ];
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call generateCompletionStream with function definition
      const stream = registryAdapter.generateCompletionStream(
        'What is the weather like in San Francisco?',
        {
          functions,
          functionCall: 'auto'
        } as LMStudioRequestOptions
      );
      
      // Collect all chunks
      const chunks: StreamingChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      // Verify the API call
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        functions,
        function_call: 'auto',
        stream: true
      }));
      
      // Verify the chunks
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(chunk => chunk.chunk === 'I\'ll check the weather')).toBe(true);
      expect(chunks.some(chunk => chunk.chunk.includes('Function Call'))).toBe(true);
      expect(chunks.some(chunk => chunk.done)).toBe(true);
    });
  });

  /**
   * Test 6: Error Handling
   * Test error scenarios to ensure proper error handling.
   */
  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // Mock authentication error
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: {
              message: 'Authentication failed',
              type: 'auth_error'
            }
          }
        }
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call the method and expect it to throw
      await expect(registryAdapter.generateCompletion('Test prompt')).rejects.toThrow();
    });
    
    it('should handle rate limit errors', async () => {
      // Mock rate limit error
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            error: {
              message: 'Rate limit exceeded',
              type: 'rate_limit_error'
            }
          }
        }
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call the method and expect it to throw
      await expect(registryAdapter.generateCompletion('Test prompt')).rejects.toThrow();
    });
    
    it('should handle server errors with retries', async () => {
      // Mock server error followed by success
      mockedAxios.post
        .mockRejectedValueOnce({
          response: {
            status: 500,
            data: {
              error: {
                message: 'Internal server error',
                type: 'server_error'
              }
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            id: 'test-id',
            object: 'chat.completion',
            created: Date.now(),
            model: 'llama3',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'This is a response after retry'
                },
                index: 0,
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 10,
              total_tokens: 20
            }
          }
        });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call the method
      const result = await registryAdapter.generateCompletion('Test prompt', {
        maxRetries: 3,
        initialBackoff: 10 // Small value for tests
      });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a response after retry');
      
      // Verify that the API was called twice (once for the error, once for the success)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
    
    it('should implement circuit breaker pattern', async () => {
      // Mock Redis to return an open circuit breaker state
      (app.redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        status: 'open',
        timestamp: Date.now() - 10000 // 10 seconds ago
      }));
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'llama3');
      
      // Call the method and expect it to throw a circuit breaker error
      await expect(registryAdapter.generateCompletion('Test prompt')).rejects.toThrow(/circuit breaker open/i);
      
      // Verify that the API was not called due to the open circuit breaker
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  /**
   * Test 7: Backward Compatibility
   * Verify that existing code using the adapter still works without modifications.
   */
  describe('Backward Compatibility', () => {
    it('should work with the original API pattern', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a backward compatibility test'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 10,
            total_tokens: 15
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Use the adapter directly with the original pattern
      const result = await adapter.generateCompletion('Test prompt');
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a backward compatibility test');
      expect(result).toHaveProperty('tokens.total', 15);
    });
  });
});
