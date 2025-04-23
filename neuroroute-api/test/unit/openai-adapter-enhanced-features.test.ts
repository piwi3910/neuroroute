import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import createOpenAIAdapter, { OpenAIRequestOptions } from '../../src/models/openai-adapter.js';
import { BaseModelAdapter, ChatMessage, FunctionDefinition } from '../../src/models/base-adapter.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenAI Adapter Enhanced Features', () => {
  let app: FastifyInstance;
  let adapter: BaseModelAdapter;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config
    app.decorate('config', {
      OPENAI_API_KEY: 'test-api-key'
    } as any);

    // Create adapter
    adapter = createOpenAIAdapter(app, 'gpt-4');
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('System Messages', () => {
    it('should support system messages', async () => {
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
      
      // Call the method with system message
      const result = await adapter.generateCompletion('Test prompt', {
        systemMessage: 'You are a helpful assistant.'
      } as OpenAIRequestOptions);
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a test response with system message');
      
      // Verify the API call included the system message
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Test prompt' }
        ]
      }));
    });
  });

  describe('Conversation History', () => {
    it('should support conversation history', async () => {
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
                content: 'This is a response to the conversation'
              },
              index: 0,
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 20,
            total_tokens: 50
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Define conversation history
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you for asking. How can I help you today?' },
        { role: 'user', content: 'Tell me about the weather.' }
      ];
      
      // Call the method with conversation history
      const result = await adapter.generateCompletion('', {
        messages: messages
      } as OpenAIRequestOptions);
      
      // Verify the result
      expect(result).toHaveProperty('text', 'This is a response to the conversation');
      
      // Verify the API call included the conversation history
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        messages: messages
      }));
      
      // Verify the response includes the updated conversation history
      expect(result.messages).toHaveLength(5); // Original 4 + new assistant response
      expect(result.messages?.[4]).toHaveProperty('role', 'assistant');
      expect(result.messages?.[4]).toHaveProperty('content', 'This is a response to the conversation');
    });
  });

  describe('Function Calling', () => {
    it('should support function calling', async () => {
      // Mock successful API response with function call
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
                content: null,
                function_call: {
                  name: 'get_weather',
                  arguments: '{"location":"San Francisco","unit":"celsius"}'
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
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
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
      
      // Call the method with function definition
      const result = await adapter.generateCompletion('What is the weather in San Francisco?', {
        functions: functions,
        functionCall: 'auto'
      } as OpenAIRequestOptions);
      
      // Verify the result includes the function call
      expect(result).toHaveProperty('functionCall');
      expect(result.functionCall).toHaveProperty('name', 'get_weather');
      expect(result.functionCall).toHaveProperty('arguments', '{"location":"San Francisco","unit":"celsius"}');
      
      // Verify the API call included the function definition
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        functions: functions,
        function_call: 'auto'
      }));
    });
  });

  describe('Tool Calling', () => {
    it('should support tool calling', async () => {
      // Mock successful API response with tool call
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
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc123',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location":"San Francisco","unit":"celsius"}'
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
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Define tool definition
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
      
      // Call the method with tool definition
      const result = await adapter.generateCompletion('What is the weather in San Francisco?', {
        tools: tools,
        toolChoice: 'auto'
      } as OpenAIRequestOptions);
      
      // Verify the result includes the tool calls
      expect(result).toHaveProperty('toolCalls');
      expect(result.toolCalls?.[0]).toHaveProperty('id', 'call_abc123');
      expect(result.toolCalls?.[0]).toHaveProperty('type', 'function');
      expect(result.toolCalls?.[0].function).toHaveProperty('name', 'get_weather');
      expect(result.toolCalls?.[0].function).toHaveProperty('arguments', '{"location":"San Francisco","unit":"celsius"}');
      
      // Verify the API call included the tool definition
      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(postCall[1]).toEqual(expect.objectContaining({
        tools: tools,
        tool_choice: 'auto'
      }));
    });
  });
});