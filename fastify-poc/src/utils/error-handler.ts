import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
  };
  requestId?: string;
}

/**
 * Set up global error handler for Fastify
 * @param fastify Fastify instance
 */
export function setupErrorHandler(fastify: FastifyInstance) {
  // Handle errors in JSON format
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Get request ID if available
    const requestId = request.headers['x-request-id'] || request.id;
    
    // Determine if this is a known application error
    const isAppError = error instanceof AppError;
    
    // Set status code
    const statusCode = isAppError ? error.statusCode : error.statusCode || 500;
    
    // Create error response
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message || 'An unexpected error occurred',
        code: isAppError ? error.code : error.code || 'INTERNAL_ERROR',
        statusCode,
      },
      requestId: requestId as string,
    };
    
    // Add details for application errors
    if (isAppError && error.details) {
      errorResponse.error.details = error.details;
    }
    
    // Log error
    if (statusCode >= 500) {
      request.log.error({ err: error, statusCode }, error.message);
    } else {
      request.log.info({ err: error, statusCode }, error.message);
    }
    
    // Send error response
    reply.status(statusCode).send(errorResponse);
  });

  // Handle 404 errors
  fastify.setNotFoundHandler((request, reply) => {
    const requestId = request.headers['x-request-id'] || request.id;
    
    const errorResponse: ErrorResponse = {
      error: {
        message: `Route ${request.method}:${request.url} not found`,
        code: 'NOT_FOUND',
        statusCode: 404,
      },
      requestId: requestId as string,
    };
    
    request.log.info({
      url: request.url,
      method: request.method,
      statusCode: 404,
    }, 'Route not found');
    
    reply.status(404).send(errorResponse);
  });
}

// Error utility functions
export const errors = {
  /**
   * Create a bad request error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  badRequest: (message: string, code = 'BAD_REQUEST', details?: any) => 
    new AppError(message, 400, code, details),
  
  /**
   * Create an unauthorized error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED', details?: any) => 
    new AppError(message, 401, code, details),
  
  /**
   * Create a forbidden error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  forbidden: (message = 'Forbidden', code = 'FORBIDDEN', details?: any) => 
    new AppError(message, 403, code, details),
  
  /**
   * Create a not found error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  notFound: (message = 'Resource not found', code = 'NOT_FOUND', details?: any) => 
    new AppError(message, 404, code, details),
  
  /**
   * Create a conflict error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  conflict: (message: string, code = 'CONFLICT', details?: any) => 
    new AppError(message, 409, code, details),
  
  /**
   * Create an internal server error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  internal: (message = 'Internal server error', code = 'INTERNAL_ERROR', details?: any) => 
    new AppError(message, 500, code, details),
};

export default {
  AppError,
  setupErrorHandler,
  errors,
};