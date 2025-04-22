import { FastifyInstance } from 'fastify';
import pino from 'pino';

// Logger configuration options
export interface LoggerOptions {
  level?: string;
  prettyPrint?: boolean;
  redact?: string[];
}

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
 * Add request ID to logger
 * @param fastify Fastify instance
 */
export function setupRequestLogging(fastify: FastifyInstance) {
  // Add request ID to each request
  fastify.addHook('onRequest', (request, reply, done) => {
    // Generate or use existing request ID
    const requestId = request.headers['x-request-id'] || 
                      request.id || 
                      `req-${Math.random().toString(36).substring(2, 15)}`;
    
    // Add request ID to response headers
    reply.header('x-request-id', requestId);
    
    // Add child logger with request ID to request
    request.log = request.log.child({ requestId });
    
    done();
  });

  // Log request completion
  fastify.addHook('onResponse', (request, reply, done) => {
    request.log.info({
      url: request.url,
      method: request.method,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime, // Use elapsedTime instead of getResponseTime
    }, 'request completed');
    
    done();
  });
}

export default {
  createLogger,
  setupRequestLogging,
};