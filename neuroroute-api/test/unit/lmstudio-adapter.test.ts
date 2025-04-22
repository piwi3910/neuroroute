import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { LMStudioAdapter, createLMStudioAdapter } from '../../src/models/lmstudio-adapter.js';
import { StreamingChunk } from '../../src/models/base-adapter.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LMStudioAdapter', () => {
  let fastifyMock: FastifyInstance;
  let adapter: LMStudioAdapter;
  
  beforeEach(() => {
    // Create a mock Fastify instance
    fastifyMock = {
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      config: {
        LMSTUDIO_URL: 'http://localhost:1234/v1',
        LMSTUDIO_TIMEOUT: 30000,
      },
    } as unknown as FastifyInstance;
    
    // Create the adapter
    adapter = createLMStudioAdapter(fastifyMock, 'llama-2-7b') as LMStudioAdapter;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('isAvailable', () => {
    it('should return true when the model is available', async () => {
      // Mock the axios response
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { models: ['llama-2-7b'] },
      });
      
      const result = await adapter.isAvailable();
      
      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:1234/v1/models',
        { timeout: 5000 }
      );
    });
    
    it('should return false when the model is not available', async () => {
      // Mock the axios response
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
      
      const result = await adapter.isAvailable();
      
      expect(result).toBe(false);
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('getCapabilities', () => {
    it('should return capabilities for llama models', () => {
      const llamaAdapter = createLMStudioAdapter(fastifyMock, 'llama-2-7b') as LMStudioAdapter;
      const capabilities = llamaAdapter.getCapabilities();
      
      expect(capabilities).toContain('text-generation');
      expect(capabilities).toContain('code-generation');
    });
    
    it('should return basic capabilities for other models', () => {
      const otherAdapter = createLMStudioAdapter(fastifyMock, 'generic-model') as LMStudioAdapter;
      const capabilities = otherAdapter.getCapabilities();
      
      expect(capabilities).toContain('text-generation');
      expect(capabilities).not.toContain('code-generation');
    });
  });
  
  describe('getDetails', () => {
    it('should return model details', () => {
      const details = adapter.getDetails();
      
      expect(details.provider).toBe('LMStudio');
      expect(details.version).toBe('local');
      expect(details.contextWindow).toBe(4096);
    });
  });
  
  describe('generateCompletion', () => {
    it('should generate a completion successfully', async () => {
      // Mock the axios response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-2-7b',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a test response',
              },
              index: 0,
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      });
      
      const result = await adapter.generateCompletion('Test prompt');
      
      expect(result.text).toBe('This is a test response');
      expect(result.tokens.prompt).toBe(10);
      expect(result.tokens.completion).toBe(5);
      expect(result.tokens.total).toBe(15);
      expect(result.model).toBe('llama-2-7b');
      expect(result.processingTime).toBeGreaterThan(0);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Test prompt' },
          ],
          model: 'llama-2-7b',
          stream: false,
        }),
        expect.any(Object)
      );
    });
    
    it('should handle errors and return a simulated response', async () => {
      // Mock the axios response
      mockedAxios.post.mockRejectedValueOnce(new Error('API error'));
      
      const result = await adapter.generateCompletion('Test prompt');
      
      expect(result.text).toContain('[Simulated response due to API error]');
      expect(result.tokens.prompt).toBe(3); // 'Test prompt' is 11 chars, so ~3 tokens
      expect(result.model).toBe('llama-2-7b');
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
    
    it('should estimate tokens when usage is not provided', async () => {
      // Mock the axios response without usage data
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-2-7b',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a test response',
              },
              index: 0,
              finish_reason: 'stop',
            },
          ],
          // No usage data
        },
      });
      
      const result = await adapter.generateCompletion('Test prompt');
      
      expect(result.text).toBe('This is a test response');
      expect(result.tokens.prompt).toBe(3); // Estimated
      expect(result.tokens.completion).toBe(6); // Estimated
      expect(result.tokens.total).toBe(9); // Estimated
    });
  });
  
  describe('generateCompletionStream', () => {
    it('should stream completions successfully', async () => {
      // Create a mock stream
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield 'data: {"id":"test-id","object":"chat.completion.chunk","created":1714000000,"model":"llama-2-7b","choices":[{"delta":{"content":"This"},"index":0}]}\n\n';
          yield 'data: {"id":"test-id","object":"chat.completion.chunk","created":1714000001,"model":"llama-2-7b","choices":[{"delta":{"content":" is"},"index":0}]}\n\n';
          yield 'data: {"id":"test-id","object":"chat.completion.chunk","created":1714000002,"model":"llama-2-7b","choices":[{"delta":{"content":" a"},"index":0}]}\n\n';
          yield 'data: {"id":"test-id","object":"chat.completion.chunk","created":1714000003,"model":"llama-2-7b","choices":[{"delta":{"content":" test"},"index":0,"finish_reason":"stop"}]}\n\n';
          yield 'data: [DONE]\n\n';
        },
      };
      
      // Mock the axios response
      mockedAxios.post.mockResolvedValueOnce({
        data: mockStream,
      });
      
      const chunks: StreamingChunk[] = [];
      for await (const chunk of adapter.generateCompletionStream!('Test prompt')) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBe(5); // 4 content chunks + 1 final empty chunk
      expect(chunks[0].chunk).toBe('This');
      expect(chunks[1].chunk).toBe(' is');
      expect(chunks[2].chunk).toBe(' a');
      expect(chunks[3].chunk).toBe(' test');
      expect(chunks[4].done).toBe(true);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Test prompt' },
          ],
          model: 'llama-2-7b',
          stream: true,
        }),
        expect.objectContaining({
          responseType: 'stream',
        })
      );
    });
    
    it('should handle streaming errors', async () => {
      // Mock the axios response
      mockedAxios.post.mockRejectedValueOnce(new Error('Streaming API error'));
      
      const chunks: StreamingChunk[] = [];
      for await (const chunk of adapter.generateCompletionStream!('Test prompt')) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].error).toBe(true);
      expect(chunks[0].done).toBe(true);
      expect(chunks[0].chunk).toContain('Error:');
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('countTokens', () => {
    it('should estimate token count based on text length', () => {
      const text = 'This is a test with exactly 32 characters';
      const tokenCount = adapter.countTokens(text);
      
      expect(tokenCount).toBe(8); // 32 characters / 4 = 8 tokens
    });
    
    it('should round up token count', () => {
      const text = 'This is 9 chars';
      const tokenCount = adapter.countTokens(text);
      
      expect(tokenCount).toBe(3); // 9 characters / 4 = 2.25, rounded up to 3
    });
  });
});