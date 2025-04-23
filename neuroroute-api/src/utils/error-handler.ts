import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// Error types as const object instead of enum
export const ErrorType = {
  // General errors
  INTERNAL: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  
  // Model-specific errors
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MODEL_TIMEOUT: 'MODEL_TIMEOUT',
  MODEL_RATE_LIMITED: 'MODEL_RATE_LIMITED',
  MODEL_AUTHENTICATION: 'MODEL_AUTHENTICATION',
  MODEL_QUOTA_EXCEEDED: 'MODEL_QUOTA_EXCEEDED',
  MODEL_CONTENT_FILTERED: 'MODEL_CONTENT_FILTERED',
  MODEL_INVALID_REQUEST: 'MODEL_INVALID_REQUEST',
  MODEL_CONTEXT_LENGTH: 'MODEL_CONTEXT_LENGTH',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // Database errors
  DB_ERROR: 'DB_ERROR',
  DB_CONNECTION: 'DB_CONNECTION',
  DB_QUERY: 'DB_QUERY',
  
  // Cache errors
  CACHE_ERROR: 'CACHE_ERROR',
  CACHE_MISS: 'CACHE_MISS',
  
  // Router errors
  ROUTER_NO_MODELS: 'ROUTER_NO_MODELS',
  ROUTER_ALL_MODELS_FAILED: 'ROUTER_ALL_MODELS_FAILED'
} as const;

// Error severity levels as const object instead of enum
export const ErrorSeverity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
} as const;

// Type for error details
export type ErrorDetails = Record<string, unknown>;

// Type for error type values
export type ErrorTypeValue = typeof ErrorType[keyof typeof ErrorType];

// Type for error severity values
export type ErrorSeverityValue = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// Custom error class
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: ErrorDetails;
  correlationId: string;
  severity: string;
  retryable: boolean;
  source?: string;
  timestamp: Date;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorTypeValue = ErrorType.INTERNAL,
    details?: ErrorDetails,
    severity: ErrorSeverityValue = ErrorSeverity.ERROR,
    retryable = false,
    source?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.correlationId = uuidv4();
    this.severity = severity;
    this.retryable = retryable;
    this.source = source;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }
}

// Model-specific error class
export class ModelError extends AppError {
  provider: string;
  modelId: string;
  
  constructor(
    message: string,
    provider: string,
    modelId: string,
    code: ErrorTypeValue = ErrorType.MODEL_UNAVAILABLE,
    statusCode = 503,
    details?: ErrorDetails,
    severity: ErrorSeverityValue = ErrorSeverity.ERROR,
    retryable = true
  ) {
    super(message, statusCode, code, details, severity, retryable, 'model');
    this.provider = provider;
    this.modelId = modelId;
  }
}

// Network error class
export class NetworkError extends AppError {
  endpoint?: string;
  
  constructor(
    message: string,
    endpoint?: string,
    code: ErrorTypeValue = ErrorType.NETWORK_ERROR,
    statusCode = 503,
    details?: ErrorDetails,
    severity: ErrorSeverityValue = ErrorSeverity.ERROR,
    retryable = true
  ) {
    super(message, statusCode, code, details, severity, retryable, 'network');
    this.endpoint = endpoint;
  }
}

// Database error class
export class DatabaseError extends AppError {
  operation?: string;
  
  constructor(
    message: string,
    operation?: string,
    code: ErrorTypeValue = ErrorType.DB_ERROR,
    statusCode = 500,
    details?: ErrorDetails,
    severity: ErrorSeverityValue = ErrorSeverity.ERROR,
    retryable = false
  ) {
    super(message, statusCode, code, details, severity, retryable, 'database');
    this.operation = operation;
  }
}

// Error response interface
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: ErrorDetails;
    correlationId: string;
    timestamp: string;
  };
  requestId?: string;
}

/**
 * Set up global error handler for Fastify
 * @param fastify Fastify instance
 */
export function setupErrorHandler(fastify: FastifyInstance): void {
  // Set up error telemetry
  const errorCounts = new Map<string, number>();
  const errorRates = new Map<string, number[]>();
  
  // Reset error rates every hour
  setInterval(() => {
    errorRates.clear();
  }, 60 * 60 * 1000);
  
  // Handle errors in JSON format
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Get request ID if available
    const requestId = request.headers['x-request-id'] ?? request.id;
    
    // Determine if this is a known application error
    const isAppError = error instanceof AppError;
    
    // Generate correlation ID if not already present
    const correlationId = isAppError ? error.correlationId : uuidv4();
    
    // Set status code
    const statusCode = isAppError ? error.statusCode : error.statusCode ?? 500;
    
    // Determine error code
    const errorCode = isAppError ? error.code : error.code ?? ErrorType.INTERNAL;
    
    // Track error for telemetry
    const currentCount = errorCounts.get(errorCode) ?? 0;
    errorCounts.set(errorCode, currentCount + 1);
    
    // Track error rate (per minute)
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const rateKey = `${errorCode}:${minute}`;
    const rates = errorRates.get(rateKey) ?? [];
    rates.push(now);
    errorRates.set(rateKey, rates);
    
    // Check if error rate is concerning (more than 10 per minute)
    const isHighErrorRate = rates.length > 10;
    
    // Create error response
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message ?? 'An unexpected error occurred',
        code: errorCode,
        statusCode,
        correlationId,
        timestamp: new Date().toISOString()
      },
      requestId: requestId as string,
    };
    
    // Add details for application errors
    if (isAppError && error.details) {
      errorResponse.error.details = error.details;
    }
    
    // Determine log level based on error severity
    let logLevel = 'error';
    if (isAppError) {
      const appError = error;
      logLevel = appError.severity;
      
      // Add source information to error details for internal tracking
      errorResponse.error.details ??= {};
      
      if (appError.source) {
        errorResponse.error.details.source = appError.source;
      }
      
      // For model errors, add provider and model information
      if (error instanceof ModelError) {
        const modelError = error;
        errorResponse.error.details.provider = modelError.provider;
        errorResponse.error.details.modelId = modelError.modelId;
      }
    }
    
    // Log error with appropriate level and context
    const logContext = {
      err: error,
      statusCode,
      correlationId,
      requestId,
      path: request.url,
      method: request.method,
      highErrorRate: isHighErrorRate,
      errorCount: currentCount
    };
    
    // Log with appropriate severity
    if (logLevel === 'fatal') {
      request.log.fatal(logContext, error.message);
    } else if (logLevel === 'error') {
      request.log.error(logContext, error.message);
    } else if (logLevel === 'warn') {
      request.log.warn(logContext, error.message);
    } else if (logLevel === 'info') {
      request.log.info(logContext, error.message);
    } else {
      request.log.debug(logContext, error.message);
    }
    
    // Alert on high error rates
    if (isHighErrorRate) {
      fastify.log.warn({
        errorCode,
        count: rates.length,
        timeWindow: '1 minute'
      }, 'High error rate detected');
    }
    
    // Send error response
    reply.status(statusCode).send(errorResponse);
  });

  // Handle 404 errors
  fastify.setNotFoundHandler((request, reply) => {
    const requestId = request.headers['x-request-id'] ?? request.id;
    const correlationId = uuidv4();
    
    const errorResponse: ErrorResponse = {
      error: {
        message: `Route ${request.method}:${request.url} not found`,
        code: ErrorType.NOT_FOUND,
        statusCode: 404,
        correlationId,
        timestamp: new Date().toISOString()
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
  badRequest: (message: string, code = ErrorType.BAD_REQUEST, details?: ErrorDetails) => 
    new AppError(message, 400, code, details, ErrorSeverity.WARN, false, 'api'),
  
  /**
   * Create an unauthorized error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  unauthorized: (message = 'Unauthorized', code = ErrorType.UNAUTHORIZED, details?: ErrorDetails) => 
    new AppError(message, 401, code, details, ErrorSeverity.WARN, false, 'api'),
  
  /**
   * Create a forbidden error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  forbidden: (message = 'Forbidden', code = ErrorType.FORBIDDEN, details?: ErrorDetails) => 
    new AppError(message, 403, code, details, ErrorSeverity.WARN, false, 'api'),
  
  /**
   * Create a not found error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  notFound: (message = 'Resource not found', code = ErrorType.NOT_FOUND, details?: ErrorDetails) => 
    new AppError(message, 404, code, details, ErrorSeverity.INFO, false, 'api'),
  
  /**
   * Create a conflict error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  conflict: (message: string, code = ErrorType.CONFLICT, details?: ErrorDetails) => 
    new AppError(message, 409, code, details, ErrorSeverity.WARN, false, 'api'),
  
  /**
   * Create an internal server error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  internal: (message = 'Internal server error', code = ErrorType.INTERNAL, details?: ErrorDetails) => 
    new AppError(message, 500, code, details, ErrorSeverity.ERROR, false, 'api'),
    
  /**
   * Create a model error
   * @param message Error message
   * @param provider Model provider
   * @param modelId Model ID
   * @param code Error code
   * @param details Additional details
   * @param retryable Whether the error is retryable
   * @returns ModelError instance
   */
  model: {
    unavailable: (message: string, provider: string, modelId: string, details?: ErrorDetails, retryable = true) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_UNAVAILABLE, 503, details, ErrorSeverity.ERROR, retryable),
      
    timeout: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_TIMEOUT, 504, details, ErrorSeverity.ERROR, true),
      
    rateLimited: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_RATE_LIMITED, 429, details, ErrorSeverity.WARN, true),
      
    authentication: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_AUTHENTICATION, 401, details, ErrorSeverity.ERROR, false),
      
    quotaExceeded: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_QUOTA_EXCEEDED, 429, details, ErrorSeverity.ERROR, false),
      
    contentFiltered: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_CONTENT_FILTERED, 422, details, ErrorSeverity.WARN, false),
      
    invalidRequest: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_INVALID_REQUEST, 400, details, ErrorSeverity.WARN, false),
      
    contextLength: (message: string, provider: string, modelId: string, details?: ErrorDetails) =>
      new ModelError(message, provider, modelId, ErrorType.MODEL_CONTEXT_LENGTH, 413, details, ErrorSeverity.WARN, false)
  },
  
  /**
   * Create a network error
   * @param message Error message
   * @param endpoint Endpoint URL
   * @param details Additional details
   * @returns NetworkError instance
   */
  network: {
    error: (message: string, endpoint?: string, details?: ErrorDetails) =>
      new NetworkError(message, endpoint, ErrorType.NETWORK_ERROR, 503, details, ErrorSeverity.ERROR, true),
      
    timeout: (message: string, endpoint?: string, details?: ErrorDetails) =>
      new NetworkError(message, endpoint, ErrorType.TIMEOUT, 504, details, ErrorSeverity.ERROR, true)
  },
  
  /**
   * Create a database error
   * @param message Error message
   * @param operation Database operation
   * @param details Additional details
   * @returns DatabaseError instance
   */
  database: {
    error: (message: string, operation?: string, details?: ErrorDetails) =>
      new DatabaseError(message, operation, ErrorType.DB_ERROR, 500, details, ErrorSeverity.ERROR, false),
      
    connection: (message: string, operation?: string, details?: ErrorDetails) =>
      new DatabaseError(message, operation, ErrorType.DB_CONNECTION, 503, details, ErrorSeverity.ERROR, true),
      
    query: (message: string, operation?: string, details?: ErrorDetails) =>
      new DatabaseError(message, operation, ErrorType.DB_QUERY, 500, details, ErrorSeverity.ERROR, false)
  },
  
  /**
   * Create a router error
   * @param message Error message
   * @param code Error code
   * @param details Additional details
   * @returns AppError instance
   */
  router: {
    noModels: (message = 'No models available', details?: ErrorDetails) =>
      new AppError(message, 503, ErrorType.ROUTER_NO_MODELS, details, ErrorSeverity.ERROR, false, 'router'),
      
    allModelsFailed: (message = 'All models failed', details?: ErrorDetails) =>
      new AppError(message, 503, ErrorType.ROUTER_ALL_MODELS_FAILED, details, ErrorSeverity.ERROR, false, 'router'),

    /**
     * Create a no capable models error
     * @param message Error message
     * @param details Additional details
     * @returns AppError instance
     */
    noCapableModels: (message: string, details?: ErrorDetails) =>
      new AppError(message, 500, ErrorType.ROUTER_NO_MODELS, details, ErrorSeverity.ERROR, false, 'router'),

    /**
     * Create a model request failed error
     * @param message Error message
     * @param details Additional details
     * @returns AppError instance
     */
    modelRequestFailed: (message: string, details?: ErrorDetails) =>
      new AppError(message, 500, ErrorType.MODEL_UNAVAILABLE, details, ErrorSeverity.ERROR, true, 'router'),

    /**
     * Create an invalid request error for the router
     * @param message Error message
     * @param details Additional details
     * @returns AppError instance
     */
    invalidRequest: (message: string, details?: ErrorDetails) =>
      new AppError(message, 400, ErrorType.BAD_REQUEST, details, ErrorSeverity.WARN, false, 'router'),
  }
};

// Utility to check if an error is retryable
export function isRetryableError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  
  // Network errors are generally retryable
  if (error.message.includes('ECONNREFUSED') || 
      error.message.includes('ETIMEDOUT') || 
      error.message.includes('ECONNRESET') ||
      error.message.includes('network error')) {
    return true;
  }
  
  return false;
}

// Type for external API error
export interface ExternalApiError {
  message?: string;
  code?: string;
  response?: {
    status: number;
    data?: {
      error?: {
        message?: string;
        type?: string;
      };
    };
    headers?: Record<string, string>;
  };
}

// Utility to classify errors from external APIs
export function classifyExternalError(error: unknown, provider: string, modelId: string): ModelError {
  // Convert unknown error to ExternalApiError
  const apiError = error as ExternalApiError;
  
  // Default to generic model error
  const errorMessage = apiError.message ?? 'Unknown error';
  const modelError = errors.model.unavailable(
    `${provider} API error: ${errorMessage}`,
    provider,
    modelId,
    { originalError: apiError }
  );
  
  // No response means network error
  if (!apiError.response) {
    if (apiError.code === 'ECONNABORTED' || apiError.message?.includes('timeout')) {
      return errors.model.timeout(`${provider} API timeout`, provider, modelId, { originalError: apiError });
    }
    return modelError;
  }
  
  // Classify based on status code and error message
  const status = apiError.response.status;
  const data = apiError.response.data ?? {};
  const errorDetails = data.error?.message ?? errorMessage;
  
  switch (status) {
    case 401:
    case 403:
      return errors.model.authentication(
        `${provider} API authentication error: ${errorDetails}`,
        provider,
        modelId,
        { originalError: apiError, responseData: data }
      );
      
    case 429:
      if (data.error?.type === 'insufficient_quota' || 
          data.error?.message?.includes('quota') ||
          data.error?.message?.includes('billing')) {
        return errors.model.quotaExceeded(
          `${provider} API quota exceeded: ${errorDetails}`,
          provider,
          modelId,
          { originalError: apiError, responseData: data }
        );
      }
      return errors.model.rateLimited(
        `${provider} API rate limited: ${errorDetails}`,
        provider,
        modelId,
        { 
          originalError: apiError, 
          responseData: data, 
          retryAfter: apiError.response.headers ? apiError.response.headers['retry-after'] : undefined 
        }
      );
      
    case 400:
      return errors.model.invalidRequest(
        `${provider} API invalid request: ${errorDetails}`,
        provider,
        modelId,
        { originalError: apiError, responseData: data }
      );
      
    case 413:
      return errors.model.contextLength(
        `${provider} API context length exceeded: ${errorDetails}`,
        provider,
        modelId,
        { originalError: apiError, responseData: data }
      );
      
    case 422:
      if (data.error?.type === 'content_filter' || 
          data.error?.message?.includes('content') ||
          data.error?.message?.includes('policy')) {
        return errors.model.contentFiltered(
          `${provider} API content filtered: ${errorDetails}`,
          provider,
          modelId,
          { originalError: apiError, responseData: data }
        );
      }
      return errors.model.invalidRequest(
        `${provider} API invalid request: ${errorDetails}`,
        provider,
        modelId,
        { originalError: apiError, responseData: data }
      );
      
    default:
      return modelError;
  }
}

export default {
  AppError,
  ModelError,
  NetworkError,
  DatabaseError,
  ErrorType,
  ErrorSeverity,
  setupErrorHandler,
  errors,
  isRetryableError,
  classifyExternalError
};