import { FastifyPluginAsync } from 'fastify';
import fastifyEnv from '@fastify/env';
import { envSchema, getConfig } from '../config.js';
import fp from 'fastify-plugin';

/**
 * Environment configuration plugin
 *
 * This plugin loads and validates environment variables using @fastify/env.
 * It also decorates the fastify instance with a config property.
 */
const envPlugin: FastifyPluginAsync = async (fastify) => {
  try {
    // Set default LOG_LEVEL if not set
    if (!process.env.LOG_LEVEL) {
      process.env.LOG_LEVEL = 'info';
    } else {
      // Ensure LOG_LEVEL is one of the allowed values
      const allowedLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
      if (!allowedLevels.includes(process.env.LOG_LEVEL)) {
        fastify.log.warn(`Invalid LOG_LEVEL: ${process.env.LOG_LEVEL}, using 'info' instead`);
        process.env.LOG_LEVEL = 'info';
      }
    }
    
    // Register the env plugin
    await fastify.register(fastifyEnv, {
      schema: envSchema,
      dotenv: true, // Load .env file if it exists
      data: process.env, // Use process.env as data source
    });
  } catch (error) {
    fastify.log.error(error, 'Error loading environment variables');
    throw error;
  }

  // Get the merged configuration
  const config = getConfig();
  
  // Decorate the fastify instance with the config if it doesn't already exist
  if (!fastify.hasDecorator('config')) {
    fastify.decorate('config', config);
  } else {
    // If it exists, update it with our config
    Object.assign(fastify.config, config);
  }
  
  // Log environment configuration (excluding sensitive data)
  const {
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    DATABASE_URL,
    ...loggableConfig
  } = config;
  
  // Mask sensitive parts of the database URL if present
  let maskedDatabaseUrl = DATABASE_URL;
  if (DATABASE_URL) {
    try {
      const url = new URL(DATABASE_URL);
      if (url.password) {
        url.password = '********';
        maskedDatabaseUrl = url.toString();
      }
    } catch (error) {
      // Ignore URL parsing errors
    }
  }
  
  fastify.log.info({
    config: {
      ...loggableConfig,
      DATABASE_URL: maskedDatabaseUrl
    },
    env: process.env.NODE_ENV
  }, 'Environment configuration loaded');
};

export default fp(envPlugin, {
  name: 'env'
});