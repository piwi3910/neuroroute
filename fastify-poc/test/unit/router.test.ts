import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import createRouterService, { RouterService } from '../../src/services/router';
import createClassifierService from '../../src/services/classifier';
import createCacheService from '../../src/services/cache';

// Mock dependencies
jest.mock('../../src/services/classifier');
jest.mock('../../src/services/cache');

describe('Router Service', () => {
  let app: FastifyInstance;
  let routerService: RouterService;
  let mockClassifier: any;
  let mockCache: any;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config
    app.decorate('config', {
      ENABLE_CACHE: true,
      REDIS_CACHE_TTL: 300
    });

    // Mock Redis - using any to bypass type checking for tests
    app.decorate('redis', {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    } as any);

    // Mock classifier and cache services
    mockClassifier = {
      classifyPrompt: jest.fn()
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    };

    // Mock the factory functions
    (createClassifierService as jest.Mock).mockReturnValue(mockClassifier);
    (createCacheService as jest.Mock).mockReturnValue(mockCache);

    // Create router service
    routerService = createRouterService(app);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('routePrompt', () => {
    it('should route a prompt to the appropriate model', async () => {
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation']
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call the method
      const result = await routerService.routePrompt('Test prompt');

      // Verify the result
      expect(result).toBeDefined();
      expect(result.model_used).toBeDefined();
      expect(result.response).toContain('Test prompt');
      expect(result.tokens).toHaveProperty('prompt');
      expect(result.tokens).toHaveProperty('completion');
      expect(result.tokens).toHaveProperty('total');
      expect(result.classification).toHaveProperty('intent');
      expect(result.classification).toHaveProperty('confidence');
      
      // Verify the classifier was called
      expect(mockClassifier.classifyPrompt).toHaveBeenCalledWith('Test prompt');
      
      // Verify the cache was checked and set
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return cached response if available', async () => {
      // Mock cached response
      const cachedResponse = {
        response: 'Cached response',
        model_used: 'gpt-4',
        tokens: {
          prompt: 10,
          completion: 20,
          total: 30
        }
      };
      mockCache.get.mockResolvedValue(cachedResponse);

      // Call the method
      const result = await routerService.routePrompt('Test prompt');

      // Verify the result
      expect(result).toHaveProperty('response', 'Cached response');
      expect(result).toHaveProperty('model_used', 'gpt-4');
      expect(result).toHaveProperty('cached', true);
      
      // Verify the classifier was not called
      expect(mockClassifier.classifyPrompt).not.toHaveBeenCalled();
      
      // Verify the cache was checked but not set
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should use specified model if provided', async () => {
      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call the method with specific model
      const result = await routerService.routePrompt('Test prompt', 'claude-3-opus');

      // Verify the result
      expect(result).toHaveProperty('model_used', 'claude-3-opus');
      
      // Verify the classifier was not called
      expect(mockClassifier.classifyPrompt).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Mock classifier to throw an error
      mockClassifier.classifyPrompt.mockRejectedValue(new Error('Classification failed'));
      
      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Expect the method to throw an error
      await expect(routerService.routePrompt('Test prompt')).rejects.toThrow('Failed to route prompt');
    });

    it('should bypass cache if caching is disabled', async () => {
      // Disable cache - using type assertion to bypass type checking for tests
      (app as any).config.ENABLE_CACHE = false;

      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation']
      });

      // Call the method
      const result = await routerService.routePrompt('Test prompt');

      // Verify the result
      expect(result).toBeDefined();
      
      // Verify the cache was not used
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('generateCacheKey', () => {
    it('should generate a consistent cache key for the same inputs', async () => {
      // We need to access the private method, so we'll use a workaround
      // by calling routePrompt twice with the same inputs and checking if cache is used
      
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation']
      });

      // Mock cache miss then hit
      mockCache.get.mockResolvedValueOnce(null);
      
      // First call
      await routerService.routePrompt('Test prompt', 'gpt-4', 100, 0.5);
      
      // Verify cache set was called
      expect(mockCache.set).toHaveBeenCalled();
      
      // Get the cache key used
      const cacheKey = mockCache.set.mock.calls[0][0];
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock cache hit with the same key
      mockCache.get.mockImplementation((key) => {
        if (key === cacheKey) {
          return Promise.resolve({
            response: 'Cached response',
            model_used: 'gpt-4',
            tokens: { prompt: 10, completion: 20, total: 30 }
          });
        }
        return Promise.resolve(null);
      });
      
      // Second call with same parameters
      const result = await routerService.routePrompt('Test prompt', 'gpt-4', 100, 0.5);
      
      // Verify cache was hit
      expect(result).toHaveProperty('cached', true);
      expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
    });
  });
});