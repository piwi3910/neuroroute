import { FastifyPluginAsync } from 'fastify';
import fastifyEnv from '@fastify/env';
import { envSchema, AppConfig } from '../config';

// Environment configuration plugin
const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true, // Load .env file if it exists
    data: process.env, // Use process.env as data source
  });

  // Log environment configuration (excluding sensitive data)
  // Use type assertion to access config property
  const config = (fastify as any).config as AppConfig;
  const { OPENAI_API_KEY, ANTHROPIC_API_KEY, ...loggableConfig } = config;
  fastify.log.info({ config: loggableConfig }, 'Environment configuration loaded');
};

export default envPlugin;