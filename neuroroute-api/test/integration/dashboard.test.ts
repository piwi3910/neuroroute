import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import dashboardRoutes from '../../src/routes/dashboard.js';
import { metrics, resetMetrics, trackModelUsage } from '../../src/utils/logger.js';

describe('Dashboard API Endpoints', () => {
  let app: FastifyInstance;
  let mockUser: any;
  let mockToken: string;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    // Mock config
    app.decorate('config', {
      ENABLE_CACHE: true,
      ENABLE_SWAGGER: true,
      NODE_ENV: 'test',
      REDIS_CACHE_TTL: 300,
      JWT_SECRET: 'test-secret',
      JWT_EXPIRATION: '1h',
      ENABLE_JWT_AUTH: true,
      ENABLE_METRICS: true,
      ENABLE_TRACING: true
    } as any);
    
    // Create mock user with admin role
    mockUser = {
      id: '1',
      sub: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    
    // Mock token
    mockToken = 'mock-token';
    
    // Mock request.user
    app.addHook('onRequest', (request, reply, done) => {
      request.user = mockUser;
      done();
    });
    
    // Register dashboard routes
    await app.register(dashboardRoutes);
    
    // Reset metrics
    resetMetrics();
    
    // Add some test metrics
    metrics.requestCount = 100;
    metrics.errorCount = 5;
    metrics.responseTimeTotal = 10000;
    metrics.responseTimeAvg = 100;
    metrics.responseTimeMax = 500;
    metrics.responseTimeMin = 10;
    
    // Add endpoint metrics
    metrics.endpoints = {
      'GET:/test': {
        count: 50,
        responseTimeTotal: 5000,
        responseTimeAvg: 100,
        errors: 2
      },
      'POST:/test': {
        count: 30,
        responseTimeTotal: 3000,
        responseTimeAvg: 100,
        errors: 3
      }
    };
    
    // Add status code metrics
    metrics.statusCodes = {
      200: 90,
      404: 5,
      500: 5
    };
    
    // Add model usage metrics
    trackModelUsage('gpt-4', 1000, 500);
    trackModelUsage('claude-3-opus', 2000, 700);
  });

  afterEach(async () => {
    await app.close();
    resetMetrics();
  });

  describe('Metrics Endpoints', () => {
    it('should get system metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('application');
      expect(payload).toHaveProperty('system');
      expect(payload).toHaveProperty('process');
      
      // Check application metrics
      expect(payload.application.requestCount).toBe(100);
      expect(payload.application.errorCount).toBe(5);
      expect(payload.application.endpoints).toHaveProperty('GET:/test');
      expect(payload.application.models).toHaveProperty('gpt-4');
      expect(payload.application.models).toHaveProperty('claude-3-opus');
    });
    
    it('should reset metrics', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/metrics/reset',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('success', true);
      
      // Verify metrics were reset
      expect(metrics.requestCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(Object.keys(metrics.endpoints)).toHaveLength(0);
      expect(Object.keys(metrics.models)).toHaveLength(0);
    });
  });
  
  describe('Model Usage Endpoints', () => {
    it('should get model usage metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/models/usage',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('models');
      expect(payload).toHaveProperty('totalModels', 2);
      expect(payload).toHaveProperty('totalRequests', 2);
      expect(payload).toHaveProperty('totalTokens', 3000);
      
      // Check model metrics
      expect(payload.models).toHaveLength(2);
      expect(payload.models[0]).toHaveProperty('modelId');
      expect(payload.models[0]).toHaveProperty('count');
      expect(payload.models[0]).toHaveProperty('tokensTotal');
      expect(payload.models[0]).toHaveProperty('responseTimeAvg');
    });
  });
  
  describe('Endpoint Performance Endpoints', () => {
    it('should get endpoint performance metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/endpoints/performance',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('endpoints');
      expect(payload).toHaveProperty('totalEndpoints', 2);
      expect(payload).toHaveProperty('totalRequests', 100);
      expect(payload).toHaveProperty('totalErrors', 5);
      expect(payload).toHaveProperty('errorRate', 5);
      
      // Check endpoint metrics
      expect(payload.endpoints).toHaveLength(2);
      expect(payload.endpoints[0]).toHaveProperty('endpoint');
      expect(payload.endpoints[0]).toHaveProperty('count');
      expect(payload.endpoints[0]).toHaveProperty('responseTimeAvg');
      expect(payload.endpoints[0]).toHaveProperty('errors');
      expect(payload.endpoints[0]).toHaveProperty('errorRate');
    });
  });
  
  describe('Alerts Endpoints', () => {
    it('should get alerts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/alerts',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('alerts');
      expect(payload).toHaveProperty('count');
      
      // Check alerts
      if (payload.count > 0) {
        expect(payload.alerts[0]).toHaveProperty('type');
        expect(payload.alerts[0]).toHaveProperty('level');
        expect(payload.alerts[0]).toHaveProperty('message');
        expect(payload.alerts[0]).toHaveProperty('value');
        expect(payload.alerts[0]).toHaveProperty('threshold');
      }
    });
  });
  
  describe('Access Control', () => {
    it('should deny access to non-admin users', async () => {
      // Change user role to non-admin
      mockUser.roles = ['user'];
      
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toHaveProperty('error', 'Forbidden: Admin access required');
    });
  });
});