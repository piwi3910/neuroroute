import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import healthRoutes from '../../src/routes/health';

describe('Health Endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    
    // Mock Redis for testing
    app.decorate('redis', {
      ping: jest.fn().mockResolvedValue('PONG'),
    });
    
    // Register health routes
    await app.register(healthRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 200 OK with health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty('status', 'ok');
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('version');
    expect(payload).toHaveProperty('services');
    expect(payload.services).toHaveProperty('database');
    expect(payload.services).toHaveProperty('redis', 'ok');
  });
});