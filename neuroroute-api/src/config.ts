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

// Define cache strategy types
export type CacheStrategy = 'default' | 'aggressive' | 'minimal' | 'none';

// Define configuration schema
export interface AppConfig {
  // Server configuration
  PORT: number;
  HOST: string;
  NODE_ENV: NodeEnv;

  // Database configuration
  DATABASE_URL: string; // Keep only one declaration
  DB_POOL_MIN?: number;
  DB_POOL_MAX?: number;
  DB_SLOW_QUERY_THRESHOLD?: number;

  // Redis configuration
  REDIS_URL: string;
  REDIS_CACHE_TTL?: number;
  CACHE_PREFIX?: string;
  CACHE_BY_USER?: string;

  // API keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  LMSTUDIO_URL?: string;
  LMSTUDIO_TIMEOUT?: number;

  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRATION: string; // e.g., '1h', '7d'

  // Logging
  LOG_LEVEL: LogLevel;

  // API configuration
  API_RATE_LIMIT?: number;
  API_TIMEOUT?: number;
  PROMPT_RATE_LIMIT_MAX?: number;
  PROMPT_RATE_LIMIT_WINDOW?: number;
  ADMIN_RATE_LIMIT_MAX?: number;
  ADMIN_RATE_LIMIT_WINDOW?: number;

  // Feature flags
  ENABLE_CACHE: boolean;
  ENABLE_SWAGGER: boolean;
  ENABLE_JWT_AUTH: boolean;
  ENABLE_DYNAMIC_CONFIG: boolean;
  ENABLE_METRICS?: boolean;
  ENABLE_TRACING?: boolean;
  METRICS_PATH?: string;
  METRICS_SAMPLE_RATE?: number;

  // Enhanced routing options
  COST_OPTIMIZE: boolean;
  QUALITY_OPTIMIZE: boolean;
  LATENCY_OPTIMIZE: boolean;
  FALLBACK_ENABLED: boolean;
  CHAIN_ENABLED: boolean;
  CACHE_STRATEGY: CacheStrategy;
  AUTO_DEGRADED_MODE: string;
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
  JWT_SECRET: 'development-jwt-secret-change-in-production',
  JWT_EXPIRATION: '1h',
  ENABLE_JWT_AUTH: true,
  ENABLE_DYNAMIC_CONFIG: true,
  ENABLE_METRICS: true,
  ENABLE_TRACING: true,

  // Enhanced routing defaults
  COST_OPTIMIZE: false,
  QUALITY_OPTIMIZE: true,
  LATENCY_OPTIMIZE: false,
  FALLBACK_ENABLED: true,
  CHAIN_ENABLED: false,
  CACHE_STRATEGY: 'default',
  AUTO_DEGRADED_MODE: 'false', // Add AUTO_DEGRADED_MODE default
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
    LMSTUDIO_URL: {
      type: 'string',
      default: 'http://localhost:1234/v1',
    },
    LMSTUDIO_TIMEOUT: {
      type: 'number',
      default: 60000,
    },
    JWT_SECRET: {
      type: 'string',
      default: 'development-jwt-secret-change-in-production',
    },
    JWT_EXPIRATION: {
      type: 'string',
      default: '1h',
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
    ENABLE_JWT_AUTH: {
      type: 'boolean',
      default: true,
    },
    ENABLE_DYNAMIC_CONFIG: {
      type: 'boolean',
      default: true,
    },
    ENABLE_METRICS: {
      type: 'boolean',
      default: true,
    },
    ENABLE_TRACING: {
      type: 'boolean',
      default: true,
    },
    COST_OPTIMIZE: {
      type: 'boolean',
      default: false,
    },
    QUALITY_OPTIMIZE: {
      type: 'boolean',
      default: true,
    },
    LATENCY_OPTIMIZE: {
      type: 'boolean',
      default: false,
    },
    FALLBACK_ENABLED: {
      type: 'boolean',
      default: true,
    },
    CHAIN_ENABLED: {
      type: 'boolean',
      default: false,
    },
    CACHE_STRATEGY: {
      type: 'string',
      enum: ['default', 'aggressive', 'minimal', 'none'],
      default: 'default',
    },
    // Add missing optional env vars to schema if they should be configurable via env
    DB_POOL_MIN: { type: 'number' },
    DB_POOL_MAX: { type: 'number' },
    DB_SLOW_QUERY_THRESHOLD: { type: 'number' },
    CACHE_PREFIX: { type: 'string' },
    CACHE_BY_USER: { type: 'string' }, // Keep as string if expecting 'true'/'false'
    PROMPT_RATE_LIMIT_MAX: { type: 'number' },
    PROMPT_RATE_LIMIT_WINDOW: { type: 'number' },
    ADMIN_RATE_LIMIT_MAX: { type: 'number' },
    ADMIN_RATE_LIMIT_WINDOW: { type: 'number' },
    METRICS_PATH: { type: 'string' },
    METRICS_SAMPLE_RATE: { type: 'number' },
    AUTO_DEGRADED_MODE: { type: 'string' }, // Keep as string if expecting 'true'/'false'
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
    HOST: process.env.HOST ?? envConfig.HOST,
    NODE_ENV: nodeEnv,
    DATABASE_URL: process.env.DATABASE_URL ?? envConfig.DATABASE_URL,
    DB_POOL_MIN: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN, 10) : envConfig.DB_POOL_MIN,
    DB_POOL_MAX: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : envConfig.DB_POOL_MAX,
    DB_SLOW_QUERY_THRESHOLD: process.env.DB_SLOW_QUERY_THRESHOLD ? parseInt(process.env.DB_SLOW_QUERY_THRESHOLD, 10) : envConfig.DB_SLOW_QUERY_THRESHOLD,
    REDIS_URL: process.env.REDIS_URL ?? envConfig.REDIS_URL,
    REDIS_CACHE_TTL: process.env.REDIS_CACHE_TTL ? parseInt(process.env.REDIS_CACHE_TTL, 10) : envConfig.REDIS_CACHE_TTL,
    CACHE_PREFIX: process.env.CACHE_PREFIX ?? envConfig.CACHE_PREFIX,
    CACHE_BY_USER: process.env.CACHE_BY_USER ?? envConfig.CACHE_BY_USER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LMSTUDIO_URL: process.env.LMSTUDIO_URL ?? envConfig.LMSTUDIO_URL,
    LMSTUDIO_TIMEOUT: process.env.LMSTUDIO_TIMEOUT ? parseInt(process.env.LMSTUDIO_TIMEOUT, 10) : envConfig.LMSTUDIO_TIMEOUT,
    JWT_SECRET: process.env.JWT_SECRET ?? envConfig.JWT_SECRET,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION ?? envConfig.JWT_EXPIRATION,
    LOG_LEVEL: (process.env.LOG_LEVEL as LogLevel) || envConfig.LOG_LEVEL,
    API_RATE_LIMIT: process.env.API_RATE_LIMIT ? parseInt(process.env.API_RATE_LIMIT, 10) : envConfig.API_RATE_LIMIT,
    API_TIMEOUT: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : envConfig.API_TIMEOUT,
    PROMPT_RATE_LIMIT_MAX: process.env.PROMPT_RATE_LIMIT_MAX ? parseInt(process.env.PROMPT_RATE_LIMIT_MAX, 10) : envConfig.PROMPT_RATE_LIMIT_MAX,
    PROMPT_RATE_LIMIT_WINDOW: process.env.PROMPT_RATE_LIMIT_WINDOW ? parseInt(process.env.PROMPT_RATE_LIMIT_WINDOW, 10) : envConfig.PROMPT_RATE_LIMIT_WINDOW,
    ADMIN_RATE_LIMIT_MAX: process.env.ADMIN_RATE_LIMIT_MAX ? parseInt(process.env.ADMIN_RATE_LIMIT_MAX, 10) : envConfig.ADMIN_RATE_LIMIT_MAX,
    ADMIN_RATE_LIMIT_WINDOW: process.env.ADMIN_RATE_LIMIT_WINDOW ? parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW, 10) : envConfig.ADMIN_RATE_LIMIT_WINDOW,
    ENABLE_CACHE: process.env.ENABLE_CACHE ? process.env.ENABLE_CACHE === 'true' : envConfig.ENABLE_CACHE,
    ENABLE_SWAGGER: process.env.ENABLE_SWAGGER ? process.env.ENABLE_SWAGGER === 'true' : envConfig.ENABLE_SWAGGER,
    ENABLE_JWT_AUTH: process.env.ENABLE_JWT_AUTH ? process.env.ENABLE_JWT_AUTH === 'true' : envConfig.ENABLE_JWT_AUTH,
    ENABLE_DYNAMIC_CONFIG: process.env.ENABLE_DYNAMIC_CONFIG ? process.env.ENABLE_DYNAMIC_CONFIG === 'true' : envConfig.ENABLE_DYNAMIC_CONFIG,
    ENABLE_METRICS: process.env.ENABLE_METRICS ? process.env.ENABLE_METRICS === 'true' : envConfig.ENABLE_METRICS,
    ENABLE_TRACING: process.env.ENABLE_TRACING ? process.env.ENABLE_TRACING === 'true' : envConfig.ENABLE_TRACING,
    METRICS_PATH: process.env.METRICS_PATH ?? envConfig.METRICS_PATH,
    METRICS_SAMPLE_RATE: process.env.METRICS_SAMPLE_RATE ? parseFloat(process.env.METRICS_SAMPLE_RATE) : envConfig.METRICS_SAMPLE_RATE,

    // Enhanced routing options
    COST_OPTIMIZE: process.env.COST_OPTIMIZE ? process.env.COST_OPTIMIZE === 'true' : envConfig.COST_OPTIMIZE,
    QUALITY_OPTIMIZE: process.env.QUALITY_OPTIMIZE ? process.env.QUALITY_OPTIMIZE === 'true' : envConfig.QUALITY_OPTIMIZE,
    LATENCY_OPTIMIZE: process.env.LATENCY_OPTIMIZE ? process.env.LATENCY_OPTIMIZE === 'true' : envConfig.LATENCY_OPTIMIZE,
    FALLBACK_ENABLED: process.env.FALLBACK_ENABLED ? process.env.FALLBACK_ENABLED === 'true' : envConfig.FALLBACK_ENABLED,
    CHAIN_ENABLED: process.env.CHAIN_ENABLED ? process.env.CHAIN_ENABLED === 'true' : envConfig.CHAIN_ENABLED,
    CACHE_STRATEGY: (process.env.CACHE_STRATEGY as CacheStrategy) || envConfig.CACHE_STRATEGY,
    AUTO_DEGRADED_MODE: process.env.AUTO_DEGRADED_MODE ?? envConfig.AUTO_DEGRADED_MODE,
  };
}

export default getConfig;