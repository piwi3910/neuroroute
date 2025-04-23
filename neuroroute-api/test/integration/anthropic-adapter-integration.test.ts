import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import createAnthropicAdapter, { AnthropicRequestOptions } from '../../src/models/anthropic-adapter';
import { BaseModelAdapter, ChatMessage, ToolDefinition, StreamingChunk } from '../../src/models/base-adapter';
import { getModelAdapter } from '../../src/models/adapter-registry';

// Mock the adapter registry module
jest.mock('../../src/models/adapter-registry', () => ({
  getModelAdapter: jest.fn()
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Integration tests for the enhanced Anthropic adapter
 * 
 * These tests verify the interactions between the Anthropic adapter and other components
 * of the system, focusing on the new features added to support the latest Anthropic API.
 */
describe('Anthropic Adapter Integration Tests', () => {
  let app: FastifyInstance;
  let adapter: BaseModelAdapter;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config
    app.decorate('config', {
      ANTHROPIC_API_KEY: 'test-api-key',
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
    adapter = createAnthropicAdapter(app, 'claude-3-sonnet');

    // Set up the mock for getModelAdapter
    (getModelAdapter as jest.Mock).mockReturnValue(adapter);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  /**
   * Test 1: Basic Functionality
   * Verify that the basic functionality of the Anthropic adapter still works with the original API.
   */
  describe('Basic Functionality', () => {
    it('should generate a completion using the original API', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'This is a test response'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          },
          stop_reason: 'stop',
          stop_sequence: null
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
      expect(result).toHaveProperty('model', 'claude-3-7-sonnet-latest');
      expect(result).toHaveProperty('processingTime');
      
      // Verify the API call
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.anthropic.com/v1/messages');
      expect(postCall[1]).toEqual(expect.objectContaining({
        model: 'claude-3-7-sonnet-latest',
        messages: [{ role: 'user', content: 'Test prompt' }],
        max_tokens: 100
      }));
    });

    it('should be accessible through the adapter registry', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'This is a test response'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method
      const result = await registryAdapter.generateCompletion('Test prompt', { maxTokens: 100 });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      expect(result).toHaveProperty('model', 'claude-3-7-sonnet-latest');
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
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'This is a test response with system message'
            }
          ],
          usage: {
            input_tokens: 15,
            output_tokens: 25
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method with system message
      const result = await registryAdapter.generateCompletion('Test prompt', {
        systemMessage: 'You are a helpful assistant.'
      } as AnthropicRequestOptions);
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response with system message');
      
      // Verify the API call included the system message
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        system: 'You are a helpful assistant.',
        messages: [
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
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Hello! How can I help you today?'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 10
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      // Mock second API response
      const mockResponse2 = {
        data: {
          id: 'test-id-2',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Paris is the capital of France.'
            }
          ],
          usage: {
            input_tokens: 30,
            output_tokens: 10
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // First turn
      const result1 = await registryAdapter.generateCompletion('Hello', {
        systemMessage: 'You are a helpful assistant.'
      } as AnthropicRequestOptions);
      
      // Verify first response
      expect(result1).toHaveProperty('text', 'Hello! How can I help you today?');
      expect(result1.messages).toHaveLength(3); // system, user, assistant
      
      // Second turn - use the conversation history from the first turn
      const result2 = await registryAdapter.generateCompletion('What is the capital of France?', {
        messages: result1.messages
      } as AnthropicRequestOptions);
      
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
   * Test 4: Tool Usage
   * Test the tool usage capabilities.
   */
  describe('Tool Usage', () => {
    it('should support tool calling and tool responses', async () => {
      // Define a weather tool
      const weatherTool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g., San Francisco, CA',
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The unit of temperature',
              },
            },
            required: ['location'],
          },
        },
      };

      // Mock first API response with tool call
      const mockResponse1 = {
        data: {
          id: 'test-id-1',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I need to check the weather for you.'
            },
            {
              type: 'tool_use',
              id: 'call_abc123',
              name: 'get_weather',
              input: {
                location: 'Tokyo',
                unit: 'celsius'
              }
            }
          ],
          usage: {
            input_tokens: 25,
            output_tokens: 15
          },
          stop_reason: 'tool_use',
          stop_sequence: null
        }
      };
      
      // Mock second API response after tool call
      const mockResponse2 = {
        data: {
          id: 'test-id-2',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'The weather in Tokyo is currently 22°C and sunny.'
            }
          ],
          usage: {
            input_tokens: 40,
            output_tokens: 20
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // First call with tool definition
      const result1 = await registryAdapter.generateCompletion('What is the weather in Tokyo?', {
        tools: [weatherTool],
        toolChoice: 'auto'
      } as AnthropicRequestOptions);
      
      // Verify tool call in response
      expect(result1).toHaveProperty('toolCalls');
      expect(result1.toolCalls).toHaveLength(1);
      expect(result1.toolCalls?.[0]).toHaveProperty('function.name', 'get_weather');
      expect(result1.toolCalls?.[0]).toHaveProperty('function.arguments');
      expect(JSON.parse(result1.toolCalls?.[0].function.arguments || '{}')).toEqual({
        location: 'Tokyo',
        unit: 'celsius'
      });
      
      // Simulate tool execution and continue conversation
      const toolResult = JSON.stringify({
        location: 'Tokyo',
        temperature: 22,
        unit: 'celsius',
        condition: 'sunny'
      });
      
      // Continue conversation with tool result
      const toolMessages = [
        ...(result1.messages || []),
        {
          role: 'tool',
          content: toolResult,
          tool_call_id: result1.toolCalls?.[0].id
        }
      ];
      
      // Second call with tool result
      const result2 = await registryAdapter.generateCompletion('', {
        messages: toolMessages
      } as AnthropicRequestOptions);
      
      // Verify response after tool call
      expect(result2).toHaveProperty('text', 'The weather in Tokyo is currently 22°C and sunny.');
      
      // Verify the API calls
      const firstPostCall = mockedAxios.post.mock.calls[0];
      expect(firstPostCall[1]).toEqual(expect.objectContaining({
        tools: [weatherTool],
        tool_choice: 'auto'
      }));
      
      const secondPostCall = mockedAxios.post.mock.calls[1];
      expect(secondPostCall[1]).toHaveProperty('messages');
      const toolResponseMessages = (secondPostCall[1] as any).messages as ChatMessage[];
      expect(toolResponseMessages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          content: toolResult
        })
      );
    });
  });

  /**
   * Test 5: Extended Thinking
   * Test the extended thinking capability.
   */
  describe('Extended Thinking', () => {
    it('should support extended thinking', async () => {
      // Mock API response with thinking content
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'Let me solve this step by step. The train travels at 60 mph for 2 hours, so it covers 60 * 2 = 120 miles. Then it travels at 30 mph for 1 hour, covering 30 miles. Total distance is 120 + 30 = 150 miles. Total time is 2 + 1 = 3 hours. Average speed = total distance / total time = 150 / 3 = 50 mph.'
            },
            {
              type: 'text',
              text: 'To find the average speed for the entire journey, I need to calculate the total distance traveled and divide it by the total time.\n\nStep 1: Calculate the distance traveled at 60 mph for 2 hours.\nDistance = Speed × Time\nDistance = 60 mph × 2 hours = 120 miles\n\nStep 2: Calculate the distance traveled at 30 mph for 1 hour.\nDistance = 30 mph × 1 hour = 30 miles\n\nStep 3: Calculate the total distance.\nTotal distance = 120 miles + 30 miles = 150 miles\n\nStep 4: Calculate the total time.\nTotal time = 2 hours + 1 hour = 3 hours\n\nStep 5: Calculate the average speed.\nAverage speed = Total distance ÷ Total time\nAverage speed = 150 miles ÷ 3 hours = 50 mph\n\nThe average speed for the entire journey is 50 mph.'
            }
          ],
          usage: {
            input_tokens: 30,
            output_tokens: 50
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method with extended thinking enabled
      const result = await registryAdapter.generateCompletion(
        'Solve this step by step: If a train travels at 60 mph for 2 hours, then at 30 mph for 1 hour, what is the average speed for the entire journey?',
        {
          thinking: {
            type: 'enabled',
            budget_tokens: 500
          }
        } as AnthropicRequestOptions
      );
      
      // Verify the result
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('The average speed for the entire journey is 50 mph.');
      
      // Verify thinking content is included in the raw response
      expect(result).toHaveProperty('raw');
      expect(result.raw).toHaveProperty('thinking');
      expect(result.raw?.thinking).toContain('Let me solve this step by step');
      
      // Verify the API call included the thinking configuration
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        thinking: {
          type: 'enabled',
          budget_tokens: 500
        }
      }));
    });
  });

  /**
   * Test 6: Streaming
   * Test the enhanced streaming support.
   */
  describe('Streaming', () => {
    it('should support streaming responses', async () => {
      // Mock streaming events
      const mockEvents = [
        { type: 'message_start', message: { id: 'msg_123', model: 'claude-3-sonnet', type: 'message' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'This ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'is ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'a ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'streaming ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'response.' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' }
      ];
      
      // Mock axios response for streaming
      mockedAxios.post.mockResolvedValue({
        data: mockEvents.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
        headers: {
          'content-type': 'text/event-stream'
        }
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Ensure the adapter supports streaming
      expect(registryAdapter.supportsStreaming()).toBe(true);
      
      // Call the streaming method
      const stream = registryAdapter.generateCompletionStream?.('Test prompt', {
        systemMessage: 'You are a helpful assistant.'
      } as AnthropicRequestOptions);
      
      // Verify the stream
      if (!stream) {
        throw new Error('Stream is undefined');
      }
      
      // Collect all chunks
      const chunks: StreamingChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      // Verify the chunks
      expect(chunks.length).toBeGreaterThan(0);
      
      // Verify the content of the chunks
      const fullText = chunks.map((chunk: StreamingChunk) => chunk.chunk).join('');
      expect(fullText).toBe('This is a streaming response.');
      
      // Verify the last chunk has done=true
      expect((chunks[chunks.length - 1] as StreamingChunk).done).toBe(true);
      
      // Verify the API call included the system message and streaming flag
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        system: 'You are a helpful assistant.',
        stream: true
      }));
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
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'This is a test response'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Create adapter directly
      const directAdapter = createAnthropicAdapter(app, 'claude-3-sonnet');
      
      // Call the method with original API pattern
      const result = await directAdapter.generateCompletion('Test prompt', {
        maxTokens: 100,
        temperature: 0.7
      });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      expect(result).toHaveProperty('tokens.prompt', 10);
      expect(result).toHaveProperty('tokens.completion', 20);
      expect(result).toHaveProperty('tokens.total', 30);
      
      // Verify the API call used the original parameters
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toEqual(expect.objectContaining({
        max_tokens: 100,
        temperature: 0.7
      }));
    });

    it('should work with the adapter registry', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'message',
          model: 'claude-3-sonnet',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'This is a test response'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          },
          stop_reason: 'stop',
          stop_sequence: null
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method with original API pattern
      const result = await registryAdapter.generateCompletion('Test prompt', {
        maxTokens: 100,
        temperature: 0.7
      });
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response');
      expect(result).toHaveProperty('model', 'claude-3-7-sonnet-latest');
    });
  });

  /**
   * Test 8: Error Handling
   * Test error scenarios to ensure proper error handling.
   */
  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // Mock authentication error
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: {
              type: 'authentication_error',
              message: 'Invalid API key'
            }
          }
        }
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method and expect it to throw
      try {
        await registryAdapter.generateCompletion('Test prompt');
        expect(true).toBe(false); // This line should not be reached
      } catch (error: any) {
        expect(error).toHaveProperty('code', 'MODEL_AUTHENTICATION_ERROR');
        expect(error).toHaveProperty('provider', 'anthropic');
        expect(error).toHaveProperty('model', 'claude-3-sonnet');
      }
    });

    it('should handle rate limit errors', async () => {
      // Mock rate limit error
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 429,
          data: {
            error: {
              type: 'rate_limit_error',
              message: 'Rate limit exceeded'
            }
          }
        }
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method and expect it to throw
      try {
        await registryAdapter.generateCompletion('Test prompt');
        expect(true).toBe(false); // This line should not be reached
      } catch (error: any) {
        expect(error).toHaveProperty('code', 'MODEL_RATE_LIMIT_ERROR');
        expect(error).toHaveProperty('provider', 'anthropic');
        expect(error).toHaveProperty('model', 'claude-3-sonnet');
      }
    });

    it('should handle content filter errors', async () => {
      // Mock content filter error
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: {
              type: 'content_policy_violation',
              message: 'Your request was rejected due to content policy violation'
            }
          }
        }
      });
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method and expect it to throw
      try {
        await registryAdapter.generateCompletion('Test prompt');
        expect(true).toBe(false); // This line should not be reached
      } catch (error: any) {
        expect(error).toHaveProperty('code', 'MODEL_CONTENT_FILTER_ERROR');
        expect(error).toHaveProperty('provider', 'anthropic');
        expect(error).toHaveProperty('model', 'claude-3-sonnet');
      }
    });

    it('should handle server errors with retries', async () => {
      // Mock server error followed by success
      mockedAxios.post
        .mockRejectedValueOnce({
          response: {
            status: 500,
            data: {
              error: {
                type: 'server_error',
                message: 'Internal server error'
              }
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            id: 'test-id',
            type: 'message',
            model: 'claude-3-sonnet',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'This is a test response after retry'
              }
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 20
            },
            stop_reason: 'stop',
            stop_sequence: null
          }
        });
      
      // Mock Redis for circuit breaker
      const redisMock = (app as any).redis;
      redisMock.get.mockResolvedValue(null); // No circuit breaker state
      
      // Get adapter from registry
      const registryAdapter = getModelAdapter(app, 'claude-3-sonnet');
      
      // Call the method
      const result = await registryAdapter.generateCompletion('Test prompt', {
        maxRetries: 1,
        initialBackoff: 10 // Small backoff for tests
      });
      
      // Verify the result after retry
      expect(result).toHaveProperty('text', 'This is a test response after retry');
      
      // Verify that post was called twice (initial + retry)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });
});