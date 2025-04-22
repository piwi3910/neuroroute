import { FastifyPluginAsync } from 'fastify';
import fastifySwagger from '@fastify/swagger';

// Swagger configuration plugin
const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifySwagger, {
    routePrefix: '/documentation',
    swagger: {
      info: {
        title: 'NeuroRoute API',
        description: 'NeuroRoute API documentation',
        version: '1.0.0',
      },
      externalDocs: {
        url: 'https://github.com/yourusername/neuroroute',
        description: 'Find more info here',
      },
      host: `${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'models', description: 'Model information endpoints' },
        { name: 'prompt', description: 'Prompt routing endpoints' },
      ],
    },
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    exposeRoute: true,
  });

  fastify.log.info('Swagger plugin registered');
};

export default swaggerPlugin;