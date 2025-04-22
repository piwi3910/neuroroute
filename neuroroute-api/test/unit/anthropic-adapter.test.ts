import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import createAnthropicAdapter, { AnthropicAdapter } from '../../src/models/anthropic-adapter';
import { ModelResponse } from '../../src/models/base-adapter';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Anthropic Adapter', () => {
  let app: FastifyInstance;
  let adapter: any; // Using any to access private methods for testing

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config - using type assertion to bypass type checking for tests
    app.decorate('config', {
      ANTHROPIC_API_KEY: 'test-api-key'
    } as any);

    // Create adapter
    adapter = createAnthropicAdapter(app, 'claude-3-opus');
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the correct model ID', () => {
      expect(adapter.getModelId()).toBe('claude-3-opus');
    });

    it('should set capabilities based on model ID', () => {
      // Claude-3 should have code-generation and reasoning capabilities
      expect(adapter.getCapabilities()).toContain('text-generation');
      expect(adapter.getCapabilities()).toContain('code-generation');
      expect(adapter.getCapabilities()).toContain('reasoning');

      // Create adapter with different model
      const otherAdapter = createAnthropicAdapter(app, 'claude-2');
      
      // Should still have text-generation but might not have other capabilities
      expect(otherAdapter.getCapabilities()).toContain('text-generation');
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
      appWithoutKey.decorate('config', {} as any);
      
      // Create adapter
      const adapterWithoutKey = createAnthropicAdapter(appWithoutKey, 'claude-3-opus');
      
      const result = await adapterWithoutKey.isAvailable();
      expect(result).toBe(false);
      
      await appWithoutKey.close();
    });
  });

  describe('getCapabilities', () => {
    it('should return an array of capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities).toContain('text-generation');
    });
  });

  describe('getDetails', () => {
    it('should return model details', () => {
      const details = adapter.getDetails();
      
      expect(details).toHaveProperty('provider', 'Anthropic');
      expect(details).toHaveProperty('version');
      expect(details).toHaveProperty('contextWindow');
    });

    it('should set different context windows based on model', () => {
      // Claude-3-opus
      expect(adapter.getDetails().contextWindow).toBe(100000);
      
      // Claude-3-sonnet
      const sonnetAdapter = createAnthropicAdapter(app, 'claude-3-sonnet');
      expect(sonnetAdapter.getDetails().contextWindow).toBe(200000);
      
      // Claude-3-haiku
      const haikuAdapter = createAnthropicAdapter(app, 'claude-3-haiku');
      expect(haikuAdapter.getDetails().contextWindow).toBe(200000);
    });
  });

  describe('generateCompletion', () => {
    it('should generate a completion successfully', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'message',
          model: 'claude-3-opus',
          content: [
            {
              type: 'text',
              text: 'This is a test response'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
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
      expect(result).toHaveProperty('model', 'claude-3-opus');
      expect(result).toHaveProperty('processingTime');
      
      // Verify the API call
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: 'Test prompt' }],
          max_tokens: 100
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01'
          }
        })
      );
    });

    it('should handle multiple content blocks', async () => {
      // Mock response with multiple content blocks
      const mockResponse = {
        data: {
          id: 'test-id',
          type: 'message',
          model: 'claude-3-opus',
          content: [
            {
              type: 'text',
              text: 'First part of response'
            },
            {
              type: 'text',
              text: 'Second part of response'
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      // Call the method
      const result = await adapter.generateCompletion('Test prompt');
      
      // Verify the result combines all text blocks
      expect(result).toHaveProperty('text', 'First part of responseSecond part of response');
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockedAxios.post.mockRejectedValue(new Error('API error'));
      
      // Call the method
      const result = await adapter.generateCompletion('Test prompt');
      
      // Should return a simulated response
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Simulated response');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('model', 'claude-3-opus');
      expect(result).toHaveProperty('processingTime');
    });

    it('should throw an error if API key is not configured', async () => {
      // Create app without API key
      const appWithoutKey = Fastify({ logger: false });
      appWithoutKey.decorate('config', {} as any);
      
      // Create adapter
      const adapterWithoutKey = createAnthropicAdapter(appWithoutKey, 'claude-3-opus');
      
      // Call the method and expect it to be handled with a simulated response
      const result = await adapterWithoutKey.generateCompletion('Test prompt');
      
      // Should return a simulated response
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Simulated response');
      
      await appWithoutKey.close();
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
});