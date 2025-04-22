import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RouterService } from '../../src/services/router.js';
import * as adapterRegistry from '../../src/models/adapter-registry.js';

// Mock the model adapter registry
vi.mock('../../src/models/adapter-registry.js', () => ({
  getModelAdapter: vi.fn()
}));

// Mock the classifier service
vi.mock('../../src/services/classifier.js', () => ({
  default: vi.fn(() => ({
    classifyPrompt: vi.fn().mockResolvedValue({
      type: 'general',
      complexity: 'medium',
      features: ['text-generation'],
      priority: 'medium',
      confidence: 0.7,
      tokens: {
        estimated: 100,
        completion: 100
      }
    })
  }))
}));

// Mock the cache service
vi.mock('../../src/services/cache.js', () => ({
  default: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true)
  }))
}));

// Mock the logger
vi.mock('../../src/utils/logger.js', () => ({
  trackModelUsage: vi.fn(),
  startTrace: vi.fn().mockReturnValue('trace-id'),
  endTrace: vi.fn()
}));

describe('Router Service Integration with Model Adapters', () => {
  let routerService: RouterService;
  let mockFastify: any;
  let mockAdapter: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock adapter
    mockAdapter = {
      generateCompletion: vi.fn().mockResolvedValue({
        text: 'This is a response from the model adapter',
        tokens: {
          prompt: 100,
          completion: 50,
          total: 150
        },
        model: 'gpt-4',
        processingTime: 1.5
      }),
      isAvailable: vi.fn().mockResolvedValue(true)
    };
    
    // Mock the getModelAdapter function
    (adapterRegistry.getModelAdapter as any).mockReturnValue(mockAdapter);
    
    // Create mock Fastify instance
    mockFastify = {
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
      },
      redis: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK')
      },
      config: {
        REDIS_CACHE_TTL: 300,
        COST_OPTIMIZE: false,
        QUALITY_OPTIMIZE: true,
        LATENCY_OPTIMIZE: false,
        FALLBACK_ENABLED: true,
        CHAIN_ENABLED: false,
        CACHE_STRATEGY: 'default'
      }
    };
    
    // Create router service
    routerService = new RouterService(mockFastify);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should use model adapter when sending to model', async () => {
    // Call sendToModel through routePrompt
    const response = await routerService.routePrompt('Test prompt', 'gpt-4');
    
    // Verify that getModelAdapter was called with the correct model ID
    expect(adapterRegistry.getModelAdapter).toHaveBeenCalledWith(mockFastify, 'gpt-4');
    
    // Verify that generateCompletion was called on the adapter
    expect(mockAdapter.generateCompletion).toHaveBeenCalledWith('Test prompt', {
      maxTokens: 1024,
      temperature: 0.7
    });
    
    // Verify the response structure
    expect(response).toEqual(expect.objectContaining({
      response: 'This is a response from the model adapter',
      model_used: 'gpt-4',
      tokens: {
        prompt: 100,
        completion: 50,
        total: 150
      }
    }));
  });

  it('should check model availability using the adapter', async () => {
    // Access the private method using any type assertion
    await (routerService as any).checkModelAvailability();
    
    // Verify that getModelAdapter was called for each model
    expect(adapterRegistry.getModelAdapter).toHaveBeenCalled();
    
    // Verify that isAvailable was called on the adapter
    expect(mockAdapter.isAvailable).toHaveBeenCalled();
  });

  it('should handle errors from the model adapter', async () => {
    // Make the adapter throw an error
    mockAdapter.generateCompletion.mockRejectedValue(new Error('API error'));
    
    // Call sendToModel through routePrompt and expect it to throw
    await expect(routerService.routePrompt('Test prompt', 'gpt-4')).rejects.toThrow('Failed to call model');
    
    // Verify that the error was logged
    expect(mockFastify.log.error).toHaveBeenCalled();
  });
});