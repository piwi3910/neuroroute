import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import createOpenAIAdapter, { OpenAIRequestOptions } from '../../src/models/openai-adapter';
import { BaseModelAdapter, ChatMessage, FunctionDefinition, ToolDefinition } from '../../src/models/base-adapter';
import { getModelAdapter } from '../../src/models/adapter-registry';

// Mock the adapter registry module
jest.mock('../../src/models/adapter-registry', () => ({
  getModelAdapter: jest.fn()
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Integration tests for the enhanced OpenAI adapter
 * 
 * These tests verify the interactions between the OpenAI adapter and other components
 * of the system, focusing on the new features added to support the OpenAI Chat Completions API.
 */
describe('OpenAI Adapter Integration Tests', () => {
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
    } as any);

    // Mock Redis for circuit breaker tests
    const redisMock = {
      get: jest.fn(),
      set: jest.fn()
    };
    
    // Use type assertion to bypass type checking for tests
    app.decorate('redis', redisMock as any);

    // Create adapter
    adapter = createOpenAIAdapter(app, 'gpt-4');

    // Set up the mock for getModelAdapter
    (getModelAdapter as jest.Mock).mockReturnValue(adapter);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  /**
   * Test 1: Basic Functionality
   * Verify that the basic functionality of the OpenAI adapter still works with the original API.
   */
  describe('Basic Functionality', () => {
    it('should generate a completion using the original API', async () => {
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
    });

    it('should be accessible through the adapter registry', async () => {
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
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'gpt-4');
      
      // Call the method
      const result = await registryAdapter.generateCompletion('Test prompt', { maxTokens: 100 });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      expect(result).toHaveProperty('model', 'gpt-4');
    });
  });

  /**
   * Test 2: System Messages
   * Test the ability to use system messages to control the assistant's behavior.
   */
  describe('System Messages', () => {
    it('should support system messages through the adapter registry', async () => {
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
                content: 'This is a test response with system message'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 25,
            total_tokens: 40
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'gpt-4');
      
      // Call the method with system message
      const result = await registryAdapter.generateCompletion('Test prompt', {
        systemMessage: 'You are a helpful assistant.'
      } as OpenAIRequestOptions);
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response with system message');
      
      // Verify the API call included the system message
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Test prompt' }
        ]
      }));
    });
  });

  /**
   * Test 3: Conversation History
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
          model: 'gpt-4',
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
          model: 'gpt-4',
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
      const registryAdapter = getModelAdapter(app, 'gpt-4');
      
      // First turn
      const result1 = await registryAdapter.generateCompletion('Hello', {
        systemMessage: 'You are a helpful assistant.'
      } as OpenAIRequestOptions);
      
      // Verify first response
      expect(result1).toHaveProperty('text', 'Hello! How can I help you today?');
      expect(result1.messages).toHaveLength(3); // system, user, assistant
      
      // Second turn - use the conversation history from the first turn
      const result2 = await registryAdapter.generateCompletion('What is the capital of France?', {
        messages: result1.messages
      } as OpenAIRequestOptions);
      
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
   * Test 4: Function Calling
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
          model: 'gpt-4',
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
          model: 'gpt-4',
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
      const registryAdapter = getModelAdapter(app, 'gpt-4');
      
      // First call with function definition
      const result1 = await registryAdapter.generateCompletion('What is the weather in New York?', {
        functions: functions,
        functionCall: 'auto'
      } as OpenAIRequestOptions);
      
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
      } as OpenAIRequestOptions);
      
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
   * Test 5: Tool Usage
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
          model: 'gpt-4',
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
          model: 'gpt-4',
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
      const registryAdapter = getModelAdapter(app, 'gpt-4');
      
      // First call with tool definition
      const result1 = await registryAdapter.generateCompletion('What is the weather in Tokyo?', {
        tools: tools,
        toolChoice: 'auto'
      } as OpenAIRequestOptions);
      
      // Verify tool call in response
      expect(result1).toHaveProperty('toolCalls');
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
      } as OpenAIRequestOptions);
      
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
   * Test 6: Backward Compatibility
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
      
      // Use the adapter with the original API pattern (just prompt and basic options)
      const result = await adapter.generateCompletion('Test prompt', {
        maxTokens: 100,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stop: ['END']
      });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      
      // Verify the API call used the correct parameters
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        max_tokens: 100,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: ['END']
      }));
    });

    it('should work with the adapter registry', async () => {
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
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'gpt-4');
      
      // Call the method
      const result = await registryAdapter.generateCompletion('Test prompt', { maxTokens: 100 });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
    });
  });

  /**
   * Test 7: Error Handling
   * Test error scenarios to ensure proper error handling.
   */
  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // Mock API error for authentication
      const authError = {
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
      
      mockedAxios.post.mockRejectedValue(authError);
      
      // Call the method and expect it to throw
      await expect(adapter.generateCompletion('Test prompt')).rejects.toThrow(/authentication/i);
    });

    it('should handle rate limit errors', async () => {
      // Mock API error for rate limit
      const rateLimitError = {
        message: 'Rate limit exceeded',
        response: {
          status: 429,
          data: {
            error: {
              message: 'Rate limit exceeded'
            }
          }
        }
      };
      
      mockedAxios.post.mockRejectedValue(rateLimitError);
      
      // Call the method and expect it to throw
      await expect(adapter.generateCompletion('Test prompt')).rejects.toThrow(/rate limit/i);
    });

    it('should handle content filter errors', async () => {
      // Mock API error for content filter
      const contentFilterError = {
        message: 'Content filter',
        response: {
          status: 400,
          data: {
            error: {
              message: 'Your request was rejected as a result of our safety system'
            }
          }
        }
      };
      
      mockedAxios.post.mockRejectedValue(contentFilterError);
      
      // Call the method and expect it to throw
      await expect(adapter.generateCompletion('Test prompt')).rejects.toThrow(/content filter/i);
    });

    it('should handle server errors with retries', async () => {
      // Mock API error for server error
      const serverError = {
        message: 'Server error',
        response: {
          status: 500,
          data: {
            error: {
              message: 'Internal server error'
            }
          }
        }
      };
      
      // First call fails, second call succeeds
      mockedAxios.post
        .mockRejectedValueOnce(serverError)
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
  });
});