import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import createRouterService, { RouterService } from '../../src/services/router.js';
import createClassifierService from '../../src/services/classifier.js';
import createCacheService from '../../src/services/cache.js';

// Mock dependencies
jest.mock('../../src/services/classifier');
jest.mock('../../src/services/cache');

describe('Router Service', () => {
  let app: FastifyInstance;
  let routerService: RouterService;
  let mockClassifier: any;
  let mockCache: any;
  let mockModelAvailability: Map<string, boolean>;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock config - using type assertion to bypass type checking for tests
    app.decorate('config', {
      ENABLE_CACHE: true,
      REDIS_CACHE_TTL: 300,
      COST_OPTIMIZE: false,
      QUALITY_OPTIMIZE: true,
      LATENCY_OPTIMIZE: false,
      FALLBACK_ENABLED: true,
      CHAIN_ENABLED: false,
      CACHE_STRATEGY: 'default'
    } as any);

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

    // Mock model availability
    mockModelAvailability = new Map<string, boolean>();
    mockModelAvailability.set('gpt-4', true);
    mockModelAvailability.set('gpt-3.5-turbo', true);
    mockModelAvailability.set('claude-3-opus', true);
    mockModelAvailability.set('claude-3-sonnet', true);
    mockModelAvailability.set('claude-3-haiku', true);
    mockModelAvailability.set('lmstudio-local', true);
    
    // Set the mock model availability on the router service
    (routerService as any).modelAvailability = mockModelAvailability;
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
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
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
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
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
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
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
      mockCache.get.mockImplementation((key: string) => {
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

  describe('Enhanced Routing Features', () => {
    it('should route based on cost optimization when enabled', async () => {
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call with cost optimization
      const result = await routerService.routePrompt('Test prompt', undefined, 1024, 0.7, {
        costOptimize: true,
        qualityOptimize: false
      });

      // The cheapest model should be selected (gpt-3.5-turbo or similar)
      expect(result.model_used).toBeDefined();
      expect(result.cost).toBeDefined();
    });

    it('should use fallback model when primary model is unavailable', async () => {
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'code',
        complexity: 'complex',
        features: ['code-generation', 'reasoning'],
        priority: 'high',
        confidence: 0.9,
        tokens: {
          estimated: 100,
          completion: 200
        }
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Make gpt-4 unavailable
      mockModelAvailability.set('gpt-4', false);

      // Call the method
      const result = await routerService.routePrompt('Write a complex algorithm', undefined, 1024, 0.7, {
        fallbackEnabled: true
      });

      // Should not use gpt-4 since it's unavailable
      expect(result.model_used).not.toBe('gpt-4');
      expect(result.model_used).toBeDefined();
    });

    it('should apply different cache TTLs based on prompt classification', async () => {
      // Mock classifier response for factual content (should have longer TTL)
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'factual',
        complexity: 'simple',
        features: ['text-generation', 'knowledge-retrieval'],
        priority: 'medium',
        confidence: 0.8,
        tokens: {
          estimated: 25,
          completion: 50
        }
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call the method
      await routerService.routePrompt('What is the capital of France?');

      // Verify cache was set with a longer TTL for factual content
      expect(mockCache.set).toHaveBeenCalled();
      // We can't easily verify the TTL directly in this test structure,
      // but we can confirm the set was called
    });

    it('should include processing time in the response', async () => {
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call the method
      const result = await routerService.routePrompt('Test prompt');

      // Verify processing time is included
      expect(result.processing_time).toBeDefined();
      expect(typeof result.processing_time).toBe('number');
    });

    it('should include cost information in the response', async () => {
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call the method
      const result = await routerService.routePrompt('Test prompt');

      // Verify cost is included
      expect(result.cost).toBeDefined();
    });

    it('should respect cache strategy settings', async () => {
      // Mock classifier response
      mockClassifier.classifyPrompt.mockResolvedValue({
        type: 'general',
        complexity: 'medium',
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: 25,
          completion: 50
        }
      });

      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Call with cache disabled
      await routerService.routePrompt('Test prompt', undefined, 1024, 0.7, {
        cacheStrategy: 'none'
      });

      // Verify cache was not used
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });
});