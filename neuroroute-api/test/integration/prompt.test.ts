import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import promptRoutes from '../../src/routes/prompt.js';
import createRouterService from '../../src/services/router.js';

// Mock the router service
jest.mock('../../src/services/router');

describe('Prompt Endpoint', () => {
  let app: FastifyInstance;
  let mockRouterService: any;

  beforeEach(async () => {
    app = Fastify({
      logger: false
    });
    
    // Mock router service
    mockRouterService = {
      routePrompt: jest.fn()
    };
    (createRouterService as jest.Mock).mockReturnValue(mockRouterService);
    
    // Register prompt routes
    await app.register(promptRoutes);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('should route a prompt successfully', async () => {
      // Mock router service response
      mockRouterService.routePrompt.mockResolvedValue({
        response: 'This is a test response',
        model_used: 'gpt-4',
        tokens: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        classification: {
          intent: 'general',
          confidence: 0.9
        }
      });
      
      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          prompt: 'Test prompt',
          max_tokens: 100,
          temperature: 0.7
        }
      });

      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('response', 'This is a test response');
      expect(payload).toHaveProperty('model_used', 'gpt-4');
      expect(payload).toHaveProperty('tokens');
      expect(payload).toHaveProperty('processing_time');
      expect(payload).toHaveProperty('request_id');
      
      // Verify router service was called with correct parameters
      expect(mockRouterService.routePrompt).toHaveBeenCalledWith(
        'Test prompt',
        undefined,
        100,
        0.7
      );
    });

    it('should use specific model if provided', async () => {
      // Mock router service response
      mockRouterService.routePrompt.mockResolvedValue({
        response: 'This is a test response',
        model_used: 'claude-3-opus',
        tokens: {
          prompt: 10,
          completion: 20,
          total: 30
        }
      });
      
      // Make request with specific model
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          prompt: 'Test prompt',
          model_id: 'claude-3-opus'
        }
      });

      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('model_used', 'claude-3-opus');
      
      // Verify router service was called with correct model
      expect(mockRouterService.routePrompt).toHaveBeenCalledWith(
        'Test prompt',
        'claude-3-opus',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should return 400 for empty prompt', async () => {
      // Make request with empty prompt
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          prompt: ''
        }
      });

      expect(response.statusCode).toBe(400);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('error');
      expect(payload.error).toContain('Prompt is required');
      
      // Verify router service was not called
      expect(mockRouterService.routePrompt).not.toHaveBeenCalled();
    });

    it('should return 400 for missing prompt', async () => {
      // Make request without prompt
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          max_tokens: 100
        }
      });

      expect(response.statusCode).toBe(400);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('error');
      
      // Verify router service was not called
      expect(mockRouterService.routePrompt).not.toHaveBeenCalled();
    });

    it('should handle router service errors', async () => {
      // Mock router service to throw an error
      mockRouterService.routePrompt.mockRejectedValue(new Error('Router error'));
      
      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          prompt: 'Test prompt'
        }
      });

      expect(response.statusCode).toBe(500);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('error');
      expect(payload).toHaveProperty('request_id');
    });

    it('should handle router service errors with status code', async () => {
      // Mock router service to throw an error with status code
      const error = new Error('Bad request') as any;
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      mockRouterService.routePrompt.mockRejectedValue(error);
      
      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          prompt: 'Test prompt'
        }
      });

      expect(response.statusCode).toBe(400);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('error', 'Bad request');
      expect(payload).toHaveProperty('code', 'BAD_REQUEST');
    });
  });
});