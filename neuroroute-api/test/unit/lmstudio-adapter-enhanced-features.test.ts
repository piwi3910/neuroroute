import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { LMStudioAdapter } from '../../src/models/lmstudio-adapter.js';
import { ModelResponse, StreamingChunk } from '../../src/models/base-adapter.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LMStudioAdapter Enhanced Features', () => {
  let adapter: LMStudioAdapter;
  let mockFastify: FastifyInstance;
  
  beforeEach(() => {
    // Create mock Fastify instance
    mockFastify = {
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
        trace: jest.fn(),
      },
      redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      },
      config: {
        LMSTUDIO_URL: 'http://localhost:1234/v1',
        LMSTUDIO_TIMEOUT: 60000,
      },
      configManager: {
        get: jest.fn().mockImplementation((key, defaultValue) => {
          if (key === 'LMSTUDIO_URL') return 'http://localhost:1234/v1';
          if (key === 'LMSTUDIO_TIMEOUT') return 60000;
          return defaultValue;
        }),
      },
    } as unknown as FastifyInstance;
    
    // Create adapter instance
    adapter = new LMStudioAdapter(mockFastify, 'llama3');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Conversation History Support', () => {
    test('should handle full conversation history', async () => {
      // Mock API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677858242,
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a response to the conversation history.',
              },
              index: 0,
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 30,
            total_tokens: 80,
          },
        },
      });
      
      // Create conversation history
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you for asking. How can I help you today?' },
        { role: 'user', content: 'Tell me about conversation history.' },
      ];
      
      // Call generateCompletion with conversation history
      const response = await adapter.generateCompletion('', { messages });
      
      // Verify the request was made with the correct messages
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          messages,
          stream: false,
        }),
        expect.any(Object)
      );
      
      // Verify response includes the conversation history
      expect(response.messages).toHaveLength(5); // Original 4 + new assistant message
      expect(response.messages?.[4].role).toBe('assistant');
      expect(response.messages?.[4].content).toBe('This is a response to the conversation history.');
    });
  });
  
  describe('Function Calling Support', () => {
    test('should handle function calling', async () => {
      // Mock API response with function call
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'chatcmpl-456',
          object: 'chat.completion',
          created: 1677858242,
          model: 'llama3',
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                function_call: {
                  name: 'get_weather',
                  arguments: '{"location":"San Francisco","unit":"celsius"}',
                },
              },
              index: 0,
              finish_reason: 'function_call',
            },
          ],
          usage: {
            prompt_tokens: 60,
            completion_tokens: 40,
            total_tokens: 100,
          },
        },
      });
      
      // Define function
      const functions = [
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
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The temperature unit to use',
              },
            },
            required: ['location'],
          },
        },
      ];
      
      // Call generateCompletion with function definition
      const response = await adapter.generateCompletion(
        'What is the weather like in San Francisco?',
        { functions, functionCall: 'auto' }
      );
      
      // Verify the request was made with the correct function definition
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          functions,
          function_call: 'auto',
        }),
        expect.any(Object)
      );
      
      // Verify response includes the function call
      expect(response.functionCall).toBeDefined();
      expect(response.functionCall?.name).toBe('get_weather');
      expect(JSON.parse(response.functionCall?.arguments || '{}')).toEqual({
        location: 'San Francisco',
        unit: 'celsius',
      });
    });
  });
  
  describe('Tool Usage Support', () => {
    test('should handle tool usage', async () => {
      // Mock API response with tool call
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'chatcmpl-789',
          object: 'chat.completion',
          created: 1677858242,
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
                      arguments: '{"location":"San Francisco","unit":"celsius"}',
                    },
                  },
                ],
              },
              index: 0,
              finish_reason: 'tool_calls',
            },
          ],
          usage: {
            prompt_tokens: 70,
            completion_tokens: 50,
            total_tokens: 120,
          },
        },
      });
      
      // Define tools
      const tools = [
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
                  description: 'The city and state, e.g. San Francisco, CA',
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'The temperature unit to use',
                },
              },
              required: ['location'],
            },
          },
        },
      ];
      
      // Call generateCompletion with tool definition
      const response = await adapter.generateCompletion(
        'What is the weather like in San Francisco?',
        { tools, toolChoice: 'auto' }
      );
      
      // Verify the request was made with the correct tool definition
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          tools,
          tool_choice: 'auto',
        }),
        expect.any(Object)
      );
      
      // Verify response includes the tool call
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls?.length).toBe(1);
      expect(response.toolCalls?.[0].type).toBe('function');
      expect(response.toolCalls?.[0].function.name).toBe('get_weather');
      expect(JSON.parse(response.toolCalls?.[0].function.arguments || '{}')).toEqual({
        location: 'San Francisco',
        unit: 'celsius',
      });
    });
  });
  
  describe('Error Handling and Resilience', () => {
    test('should retry on retryable errors', async () => {
      // Mock API responses - first fails, second succeeds
      mockedAxios.post
        .mockRejectedValueOnce({
          message: 'Network error',
          code: 'ECONNRESET',
        })
        .mockResolvedValueOnce({
          data: {
            id: 'chatcmpl-123',
            object: 'chat.completion',
            created: 1677858242,
            model: 'llama3',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'This is a response after retry.',
                },
                index: 0,
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 10,
              total_tokens: 20,
            },
          },
        });
      
      // Call generateCompletion
      const response = await adapter.generateCompletion('Hello', { maxRetries: 3 });
      
      // Verify the request was made twice (one failure, one success)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      
      // Verify response is from the successful retry
      expect(response.text).toBe('This is a response after retry.');
    });
    
    test('should use circuit breaker for non-retryable errors', async () => {
      // Mock redis to return open circuit breaker state
      mockFastify.redis.get = jest.fn().mockResolvedValue(JSON.stringify({
        status: 'open',
        timestamp: Date.now() - 10000, // 10 seconds ago
      }));
      
      // Attempt to call API with open circuit breaker
      await expect(adapter.generateCompletion('Hello')).rejects.toThrow('circuit breaker open');
      
      // Verify no API call was made due to circuit breaker
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
  
  describe('Streaming Enhancements', () => {
    test('should handle streaming with function calls', async () => {
      // Create a mock stream
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n');
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
      const functions = [
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
      
      // Call generateCompletionStream with function definition
      const stream = adapter.generateCompletionStream(
        'What is the weather like in San Francisco?',
        { functions, functionCall: 'auto' }
      );
      
      // Collect all chunks
      const chunks: StreamingChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      // Verify the request was made with the correct function definition
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          functions,
          function_call: 'auto',
          stream: true,
        }),
        expect.any(Object)
      );
      
      // Verify chunks include both text and function call
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(chunk => chunk.chunk === 'Hello')).toBe(true);
      expect(chunks.some(chunk => chunk.chunk.includes('Function Call'))).toBe(true);
      expect(chunks.some(chunk => chunk.done)).toBe(true);
    });
  });
});