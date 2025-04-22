// Configuration management for the application

// Define environment types
export type NodeEnv = 'development' | 'test' | 'production';

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
  
  // API keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  
  // Logging
  LOG_LEVEL: string;
}

// Default configuration values
export const defaultConfig: AppConfig = {
  PORT: 3000,
  HOST: '0.0.0.0',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'info',
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
  },
};

// Get configuration based on environment
export function getConfig(): AppConfig {
  return {
    ...defaultConfig,
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : defaultConfig.PORT,
    HOST: process.env.HOST || defaultConfig.HOST,
    NODE_ENV: (process.env.NODE_ENV as NodeEnv) || defaultConfig.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL || defaultConfig.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL || defaultConfig.REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL || defaultConfig.LOG_LEVEL,
  };
}

export default getConfig;