import { FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';

// CORS configuration plugin
const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyCors, {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  fastify.log.info('CORS plugin registered');
};

export default corsPlugin;