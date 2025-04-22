/**
 * Configuration management for the application
 *
 * This module provides configuration management for the application,
 * supporting different environments (development, test, production).
 */

// Define environment types
export type NodeEnv = 'development' | 'test' | 'production';

// Define log level types
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Define configuration schema
export interface AppConfig {
  // Server configuration
  PORT: number;
  HOST: string;
  NODE_ENV: NodeEnv;
  
  // Database configuration
  DATABASE_URL: string;
  
  // Redis configuration
  REDIS_URL: string;
  REDIS_CACHE_TTL: number; // Time to live in seconds
  
  // API keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  
  // Logging
  LOG_LEVEL: LogLevel;
  
  // API configuration
  API_RATE_LIMIT: number; // Requests per minute
  API_TIMEOUT: number; // Timeout in milliseconds
  
  // Feature flags
  ENABLE_CACHE: boolean;
  ENABLE_SWAGGER: boolean;
}

// Environment-specific configurations
const environments: Record<NodeEnv, Partial<AppConfig>> = {
  development: {
    LOG_LEVEL: 'debug',
    ENABLE_SWAGGER: true,
    REDIS_CACHE_TTL: 300, // 5 minutes
  },
  test: {
    LOG_LEVEL: 'info',
    ENABLE_SWAGGER: true,
    REDIS_CACHE_TTL: 60, // 1 minute
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute_test',
  },
  production: {
    LOG_LEVEL: 'warn',
    ENABLE_SWAGGER: false,
    REDIS_CACHE_TTL: 3600, // 1 hour
    API_RATE_LIMIT: 100, // Lower rate limit in production
  },
};

// Default configuration values
export const defaultConfig: AppConfig = {
  PORT: 3000,
  HOST: '0.0.0.0',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_CACHE_TTL: 300, // 5 minutes
  LOG_LEVEL: 'info',
  API_RATE_LIMIT: 200, // Requests per minute
  API_TIMEOUT: 30000, // 30 seconds
  ENABLE_CACHE: true,
  ENABLE_SWAGGER: true,
};

// Environment schema for @fastify/env plugin
export const envSchema = {
  type: 'object',
  required: ['PORT', 'HOST', 'NODE_ENV', 'DATABASE_URL', 'REDIS_URL'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0',
    },
    NODE_ENV: {
      type: 'string',
      enum: ['development', 'test', 'production'],
      default: 'development',
    },
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://postgres:postgres@localhost:5432/neuroroute',
    },
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
    },
    REDIS_CACHE_TTL: {
      type: 'number',
      default: 300,
    },
    OPENAI_API_KEY: {
      type: 'string',
    },
    ANTHROPIC_API_KEY: {
      type: 'string',
    },
    LOG_LEVEL: {
      type: 'string',
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
      default: 'info',
    },
    API_RATE_LIMIT: {
      type: 'number',
      default: 200,
    },
    API_TIMEOUT: {
      type: 'number',
      default: 30000,
    },
    ENABLE_CACHE: {
      type: 'boolean',
      default: true,
    },
    ENABLE_SWAGGER: {
      type: 'boolean',
      default: true,
    },
  },
};

/**
 * Get configuration based on environment
 *
 * This function merges the default configuration with environment-specific
 * configuration and environment variables.
 *
 * @returns The merged configuration
 */
export function getConfig(): AppConfig {
  // Get the current environment
  const nodeEnv = (process.env.NODE_ENV as NodeEnv) || 'development';
  
  // Merge default config with environment-specific config
  const envConfig = {
    ...defaultConfig,
    ...environments[nodeEnv],
  };
  
  // Override with environment variables
  return {
    ...envConfig,
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : envConfig.PORT,
    HOST: process.env.HOST || envConfig.HOST,
    NODE_ENV: nodeEnv,
    DATABASE_URL: process.env.DATABASE_URL || envConfig.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL || envConfig.REDIS_URL,
    REDIS_CACHE_TTL: process.env.REDIS_CACHE_TTL ? parseInt(process.env.REDIS_CACHE_TTL, 10) : envConfig.REDIS_CACHE_TTL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LOG_LEVEL: (process.env.LOG_LEVEL as LogLevel) || envConfig.LOG_LEVEL,
    API_RATE_LIMIT: process.env.API_RATE_LIMIT ? parseInt(process.env.API_RATE_LIMIT, 10) : envConfig.API_RATE_LIMIT,
    API_TIMEOUT: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : envConfig.API_TIMEOUT,
    ENABLE_CACHE: process.env.ENABLE_CACHE ? process.env.ENABLE_CACHE === 'true' : envConfig.ENABLE_CACHE,
    ENABLE_SWAGGER: process.env.ENABLE_SWAGGER ? process.env.ENABLE_SWAGGER === 'true' : envConfig.ENABLE_SWAGGER,
  };
}

export default getConfig;