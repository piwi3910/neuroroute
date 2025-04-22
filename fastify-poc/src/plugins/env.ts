import { FastifyPluginAsync } from 'fastify';
import fastifyEnv from '@fastify/env';
import { envSchema } from '../config';

// Environment configuration plugin
const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true, // Load .env file if it exists
    data: process.env, // Use process.env as data source
  });

  // Log environment configuration (excluding sensitive data)
  const { OPENAI_API_KEY, ANTHROPIC_API_KEY, ...loggableConfig } = fastify.config;
  fastify.log.info({ config: loggableConfig }, 'Environment configuration loaded');
};

export default envPlugin;