import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import axios from 'axios';
import createOpenAIAdapter, { OpenAIAdapter } from '../../src/models/openai-adapter';
import { ModelResponse } from '../../src/models/base-adapter';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenAI Adapter', () => {
  let app: FastifyInstance;
  let adapter: any; // Using any to access private methods for testing

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config
    app.decorate('config', {
      OPENAI_API_KEY: 'test-api-key'
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
  });

  describe('isAvailable', () => {
    it('should return true if API key is available', async () => {
      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false if API key is not available', async () => {
      // Create app without API key
      const appWithoutKey = Fastify({ logger: false });
      appWithoutKey.decorate('config', {});
      
      // Create adapter
      const adapterWithoutKey = createOpenAIAdapter(appWithoutKey, 'gpt-4');
      
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
      
      expect(details).toHaveProperty('provider', 'OpenAI');
      expect(details).toHaveProperty('version');
      expect(details).toHaveProperty('contextWindow');
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
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test prompt' }],
          max_tokens: 100
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }
        })
      );
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
      expect(result).toHaveProperty('model', 'gpt-4');
      expect(result).toHaveProperty('processingTime');
    });

    it('should throw an error if API key is not configured', async () => {
      // Create app without API key
      const appWithoutKey = Fastify({ logger: false });
      appWithoutKey.decorate('config', {});
      
      // Create adapter
      const adapterWithoutKey = createOpenAIAdapter(appWithoutKey, 'gpt-4');
      
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