import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

// Logger configuration options
export interface LoggerOptions {
  level?: string;
  prettyPrint?: boolean;
  redact?: string[];
  enableMetrics?: boolean;
  enableTracing?: boolean;
}

// Performance metrics
export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  responseTimeTotal: number;
  responseTimeAvg: number;
  responseTimeMax: number;
  responseTimeMin: number;
  statusCodes: Record<number, number>;
  endpoints: Record<string, {
    count: number;
    responseTimeTotal: number;
    responseTimeAvg: number;
    errors: number;
  }>;
  models: Record<string, {
    count: number;
    tokensTotal: number;
    responseTimeTotal: number;
  }>;
}

// Trace data
export interface TraceData {
  traceId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, any>;
}

// Global metrics store
export const metrics: PerformanceMetrics = {
  requestCount: 0,
  errorCount: 0,
  responseTimeTotal: 0,
  responseTimeAvg: 0,
  responseTimeMax: 0,
  responseTimeMin: Infinity,
  statusCodes: {},
  endpoints: {},
  models: {}
};

// Global traces store
export const traces: Record<string, TraceData> = {};

/**
 * Create a configured logger instance
 * @param options Logger options
 * @returns Pino logger instance
 */
export function createLogger(options: LoggerOptions = {}, config?: any) {
  const logLevel = options.level || (config?.LOG_LEVEL) || 'info';
  
  // Sensitive fields to redact from logs
  const redactFields = options.redact || [
    'req.headers.authorization',
    'req.headers["x-api-key"]',
    'req.body.api_key',
    'req.body.apiKey',
    'password',
    'apiKey',
    'api_key',
  ];

  // Create logger configuration
  const loggerConfig: pino.LoggerOptions = {
    level: logLevel,
    redact: {
      paths: redactFields,
      remove: true,
    },
    // Add timestamp and hostname to all logs
    timestamp: pino.stdTimeFunctions.isoTime,
    // Add correlation ID serializer
    serializers: {
      req: (req) => {
        return {
          method: req.method,
          url: req.url,
          correlationId: req.headers['x-correlation-id'] || req.id,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.ips || req.headers['x-forwarded-for']
        };
      },
      err: pino.stdSerializers.err
    }
  };

  // Add pretty printing in development
  if (options.prettyPrint || (config?.NODE_ENV !== 'production')) {
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(loggerConfig);
}

/**
 * Start a new trace
 * @param name Trace name
 * @param parentId Parent trace ID (optional)
 * @param attributes Additional attributes
 * @returns Trace ID
 */
export function startTrace(name: string, parentId?: string, attributes: Record<string, any> = {}): string {
  const traceId = randomUUID();
  
  traces[traceId] = {
    traceId,
    parentId,
    name,
    startTime: performance.now(),
    attributes
  };
  
  return traceId;
}

/**
 * End a trace
 * @param traceId Trace ID
 * @param additionalAttributes Additional attributes to add
 * @returns Trace data
 */
export function endTrace(traceId: string, additionalAttributes: Record<string, any> = {}): TraceData | null {
  const trace = traces[traceId];
  
  if (!trace) {
    return null;
  }
  
  trace.endTime = performance.now();
  trace.duration = trace.endTime - trace.startTime;
  trace.attributes = { ...trace.attributes, ...additionalAttributes };
  
  return trace;
}

/**
 * Add request ID and correlation ID to logger
 * @param fastify Fastify instance
 */
export function setupRequestLogging(fastify: FastifyInstance) {
  const enableMetrics = (fastify.config?.ENABLE_METRICS !== false);
  const enableTracing = (fastify.config?.ENABLE_TRACING !== false);
  
  // Add correlation ID and request ID to each request
  fastify.addHook('onRequest', (request, reply, done) => {
    // Get or generate correlation ID
    const correlationId = request.headers['x-correlation-id'] || 
                          randomUUID();
    
    // Generate or use existing request ID
    const requestId = request.headers['x-request-id'] || 
                      request.id || 
                      `req-${Math.random().toString(36).substring(2, 15)}`;
    
    // Add IDs to response headers
    reply.header('x-correlation-id', correlationId);
    reply.header('x-request-id', requestId);
    
    // Add child logger with correlation ID to request
    request.log = request.log.child({ 
      correlationId,
      requestId
    });
    
    // Store correlation ID and request ID in request
    request.correlationId = correlationId as string;
    
    // Start request trace if tracing is enabled
    if (enableTracing) {
      const traceId = startTrace('http_request', undefined, {
        method: request.method,
        url: request.url,
        correlationId,
        requestId
      });
      
      // Store trace ID in request
      request.traceId = traceId;
    }
    
    // Initialize metrics for this endpoint if enabled
    if (enableMetrics) {
      const endpoint = `${request.method}:${request.routeOptions?.url || request.url}`;
      
      if (!metrics.endpoints[endpoint]) {
        metrics.endpoints[endpoint] = {
          count: 0,
          responseTimeTotal: 0,
          responseTimeAvg: 0,
          errors: 0
        };
      }
    }
    
    done();
  });

  // Log request completion and update metrics
  fastify.addHook('onResponse', (request, reply, done) => {
    const responseTime = reply.elapsedTime;
    const statusCode = reply.statusCode;
    const endpoint = `${request.method}:${request.routeOptions?.url || request.url}`;
    
    // Update metrics if enabled
    if (enableMetrics) {
      // Update global metrics
      metrics.requestCount++;
      metrics.responseTimeTotal += responseTime;
      metrics.responseTimeAvg = metrics.responseTimeTotal / metrics.requestCount;
      metrics.responseTimeMax = Math.max(metrics.responseTimeMax, responseTime);
      metrics.responseTimeMin = Math.min(metrics.responseTimeMin, responseTime);
      
      // Update status code metrics
      metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
      
      // Update endpoint metrics
      const endpointMetrics = metrics.endpoints[endpoint];
      if (endpointMetrics) {
        endpointMetrics.count++;
        endpointMetrics.responseTimeTotal += responseTime;
        endpointMetrics.responseTimeAvg = endpointMetrics.responseTimeTotal / endpointMetrics.count;
        
        if (statusCode >= 400) {
          endpointMetrics.errors++;
          metrics.errorCount++;
        }
      }
    }
    
    // End request trace if tracing is enabled
    if (enableTracing && request.traceId) {
      endTrace(request.traceId, {
        statusCode,
        responseTime,
        success: statusCode < 400
      });
    }
    
    // Log request completion with correlation ID
    request.log.info({
      url: request.url,
      method: request.method,
      statusCode,
      responseTime,
      correlationId: request.correlationId
    }, 'request completed');
    
    done();
  });
  
  // Add error logging with correlation ID
  fastify.setErrorHandler((error, request, reply) => {
    // Update error metrics
    if (enableMetrics) {
      metrics.errorCount++;
      
      const endpoint = `${request.method}:${request.routeOptions?.url || request.url}`;
      if (metrics.endpoints[endpoint]) {
        metrics.endpoints[endpoint].errors++;
      }
    }
    
    // End trace with error if tracing is enabled
    if (enableTracing && request.traceId) {
      endTrace(request.traceId, {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        success: false
      });
    }
    
    // Log error with correlation ID
    request.log.error({
      error,
      url: request.url,
      method: request.method,
      correlationId: request.correlationId
    }, error.message);
    
    // Determine status code
    const statusCode = error.statusCode || 500;
    
    // Send error response
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
      requestId: request.id,
      correlationId: request.correlationId
    });
  });
}

/**
 * Get current performance metrics
 * @returns Current metrics
 */
export function getMetrics(): PerformanceMetrics {
  return { ...metrics };
}

/**
 * Reset performance metrics
 */
export function resetMetrics(): void {
  metrics.requestCount = 0;
  metrics.errorCount = 0;
  metrics.responseTimeTotal = 0;
  metrics.responseTimeAvg = 0;
  metrics.responseTimeMax = 0;
  metrics.responseTimeMin = Infinity;
  metrics.statusCodes = {};
  metrics.endpoints = {};
  metrics.models = {};
}

/**
 * Track model usage metrics
 * @param modelId Model ID
 * @param tokens Token count
 * @param responseTime Response time in ms
 */
export function trackModelUsage(modelId: string, tokens: number, responseTime: number): void {
  if (!metrics.models[modelId]) {
    metrics.models[modelId] = {
      count: 0,
      tokensTotal: 0,
      responseTimeTotal: 0
    };
  }
  
  metrics.models[modelId].count++;
  metrics.models[modelId].tokensTotal += tokens;
  metrics.models[modelId].responseTimeTotal += responseTime;
}

// Extend FastifyRequest interface to include correlation ID and trace ID
declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
    traceId?: string;
  }
}

export default {
  createLogger,
  setupRequestLogging,
  startTrace,
  endTrace,
  getMetrics,
  resetMetrics,
  trackModelUsage
};