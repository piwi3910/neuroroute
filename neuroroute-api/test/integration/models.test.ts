import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import modelsRoutes from '../../src/routes/models';

describe('Models Endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({
      logger: false
    });
    
    // Register models routes
    await app.register(modelsRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('should return a list of available models', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/'
      });

      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('models');
      expect(Array.isArray(payload.models)).toBe(true);
      expect(payload.models.length).toBeGreaterThan(0);
      
      // Check model structure
      const model = payload.models[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('capabilities');
      expect(model).toHaveProperty('status');
    });
  });

  describe('GET /:id', () => {
    it('should return details for a specific model', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/gpt-4'
      });

      expect(response.statusCode).toBe(200);
      
      const model = JSON.parse(response.payload);
      expect(model).toHaveProperty('id', 'gpt-4');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('capabilities');
      expect(model).toHaveProperty('status');
      expect(model).toHaveProperty('details');
      
      // Check details structure
      expect(model.details).toHaveProperty('contextWindow');
      expect(model.details).toHaveProperty('tokenLimit');
      expect(model.details).toHaveProperty('version');
    });

    it('should return 404 for non-existent model', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-model'
      });

      expect(response.statusCode).toBe(404);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('error');
      expect(payload.error).toContain('not found');
    });
  });
});