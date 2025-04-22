import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import healthRoutes from '../../src/routes/health';

describe('Health Endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    
    // Mock config for testing - using type assertion to bypass type checking
    app.decorate('config', {
      ENABLE_CACHE: true,
      ENABLE_SWAGGER: true,
      NODE_ENV: 'test',
      REDIS_CACHE_TTL: 300,
    } as any);
    
    // Mock Redis for testing
    app.decorate('redis', {
      ping: jest.fn().mockResolvedValue('PONG'),
    } as any); // Use type assertion to bypass type checking for the mock
    
    // Mock Prisma for testing
    app.decorate('prisma', {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any); // Use type assertion to bypass type checking for the mock
    
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
    expect(payload).toHaveProperty('environment', 'test');
    expect(payload).toHaveProperty('uptime');
    expect(payload).toHaveProperty('services');
    expect(payload.services).toHaveProperty('database', 'ok');
    expect(payload.services).toHaveProperty('redis', 'ok');
    expect(payload).toHaveProperty('config');
    expect(payload.config).toHaveProperty('cache_enabled', true);
    expect(payload.config).toHaveProperty('swagger_enabled', true);
    
    // Verify that Redis ping was called
    expect((app as any).redis.ping).toHaveBeenCalled();
    
    // Verify that Prisma query was called
    expect((app as any).prisma.$queryRaw).toHaveBeenCalled();
  });
  
  it('should handle disabled Redis correctly', async () => {
    // Update config to disable cache
    (app as any).config.ENABLE_CACHE = false;
    
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty('status', 'ok');
    expect(payload.services).toHaveProperty('redis', 'disabled');
    expect(payload.config).toHaveProperty('cache_enabled', false);
    
    // Verify that Redis ping was NOT called
    expect((app as any).redis.ping).not.toHaveBeenCalled();
  });
  
  it('should handle database errors correctly', async () => {
    // Mock database error
    (app as any).prisma.$queryRaw.mockRejectedValueOnce(new Error('Database connection error'));
    
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty('status', 'error');
    expect(payload.services).toHaveProperty('database', 'error');
  });
  
  it('should handle Redis errors correctly', async () => {
    // Mock Redis error
    (app as any).redis.ping.mockRejectedValueOnce(new Error('Redis connection error'));
    
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty('status', 'degraded');
    expect(payload.services).toHaveProperty('redis', 'error');
  });
});