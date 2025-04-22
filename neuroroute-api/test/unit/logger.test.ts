import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import {
  createLogger,
  setupRequestLogging,
  startTrace,
  endTrace,
  getMetrics,
  resetMetrics,
  trackModelUsage,
  metrics,
  traces
} from '../../src/utils/logger.js';

describe('Logger Utilities', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify({ logger: false });
    
    // Mock config
    app.decorate('config', {
      LOG_LEVEL: 'info',
      NODE_ENV: 'test',
      ENABLE_METRICS: true,
      ENABLE_TRACING: true
    } as any);
    
    // Reset metrics and traces
    resetMetrics();
    Object.keys(traces).forEach(key => delete traces[key]);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('createLogger', () => {
    it('should create a logger with default options', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
    });

    it('should create a logger with custom options', () => {
      const logger = createLogger({ level: 'debug' });
      expect(logger).toBeDefined();
      expect(logger.level).toBe('debug');
    });

    it('should use config values if provided', () => {
      const config = { LOG_LEVEL: 'warn', NODE_ENV: 'production' };
      const logger = createLogger({}, config);
      expect(logger).toBeDefined();
      expect(logger.level).toBe('warn');
    });
  });

  describe('setupRequestLogging', () => {
    it('should add request logging hooks', async () => {
      // Setup request logging
      setupRequestLogging(app);
      
      // Mock hooks
      const onRequestSpy = jest.spyOn(app, 'addHook');
      const onResponseSpy = jest.spyOn(app, 'setErrorHandler');
      
      // Register a test route
      app.get('/test', (request, reply) => {
        return { success: true };
      });
      
      // Make a request
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-correlation-id': 'test-correlation-id',
          'x-request-id': 'test-request-id'
        }
      });
      
      // Verify hooks were called
      expect(onRequestSpy).toHaveBeenCalled();
      expect(onResponseSpy).toHaveBeenCalled();
      
      // Verify response headers
      expect(response.headers['x-correlation-id']).toBe('test-correlation-id');
      expect(response.headers['x-request-id']).toBe('test-request-id');
      
      // Verify metrics were updated
      expect(metrics.requestCount).toBe(1);
      expect(metrics.endpoints['GET:/test']).toBeDefined();
      expect(metrics.endpoints['GET:/test'].count).toBe(1);
    });
    
    it('should generate correlation ID and request ID if not provided', async () => {
      // Setup request logging
      setupRequestLogging(app);
      
      // Register a test route
      app.get('/test', (request, reply) => {
        return { success: true };
      });
      
      // Make a request
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });
      
      // Verify response headers
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });
    
    it('should track error metrics', async () => {
      // Setup request logging
      setupRequestLogging(app);
      
      // Register a test route that throws an error
      app.get('/error', (request, reply) => {
        throw new Error('Test error');
      });
      
      // Make a request
      await app.inject({
        method: 'GET',
        url: '/error'
      });
      
      // Verify error metrics were updated
      expect(metrics.errorCount).toBe(1);
      expect(metrics.endpoints['GET:/error']).toBeDefined();
      expect(metrics.endpoints['GET:/error'].errors).toBe(1);
    });
  });

  describe('Tracing', () => {
    it('should create and end traces', () => {
      // Start a trace
      const traceId = startTrace('test-trace', undefined, { test: true });
      
      // Verify trace was created
      expect(traces[traceId]).toBeDefined();
      expect(traces[traceId].name).toBe('test-trace');
      expect(traces[traceId].attributes.test).toBe(true);
      
      // End the trace
      const trace = endTrace(traceId, { result: 'success' });
      
      // Verify trace was ended
      expect(trace).toBeDefined();
      expect(trace?.endTime).toBeDefined();
      expect(trace?.duration).toBeDefined();
      expect(trace?.attributes.result).toBe('success');
    });
    
    it('should support nested traces', () => {
      // Start a parent trace
      const parentId = startTrace('parent-trace');
      
      // Start a child trace
      const childId = startTrace('child-trace', parentId);
      
      // Verify parent-child relationship
      expect(traces[childId].parentId).toBe(parentId);
      
      // End the traces
      endTrace(childId);
      endTrace(parentId);
      
      // Verify both traces were ended
      expect(traces[childId].endTime).toBeDefined();
      expect(traces[parentId].endTime).toBeDefined();
    });
    
    it('should handle non-existent trace IDs', () => {
      const result = endTrace('non-existent-trace');
      expect(result).toBeNull();
    });
  });

  describe('Metrics', () => {
    it('should track and reset metrics', () => {
      // Track some metrics
      trackModelUsage('gpt-4', 100, 500);
      trackModelUsage('gpt-4', 200, 700);
      trackModelUsage('claude-3', 150, 600);
      
      // Verify metrics were tracked
      expect(metrics.models['gpt-4']).toBeDefined();
      expect(metrics.models['gpt-4'].count).toBe(2);
      expect(metrics.models['gpt-4'].tokensTotal).toBe(300);
      expect(metrics.models['gpt-4'].responseTimeTotal).toBe(1200);
      
      expect(metrics.models['claude-3']).toBeDefined();
      expect(metrics.models['claude-3'].count).toBe(1);
      
      // Get metrics
      const currentMetrics = getMetrics();
      expect(currentMetrics).toEqual(metrics);
      
      // Reset metrics
      resetMetrics();
      
      // Verify metrics were reset
      expect(metrics.models['gpt-4']).toBeUndefined();
      expect(metrics.models['claude-3']).toBeUndefined();
      expect(metrics.requestCount).toBe(0);
    });
  });
});