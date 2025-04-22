import { FastifyPluginAsync } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// Swagger configuration plugin
const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Use type assertion to access config property
  const config = (fastify as any).config;
  const host = config?.HOST || 'localhost';
  const port = config?.PORT || 3000;

  // Register Swagger UI
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'NeuroRoute API',
        description: 'NeuroRoute API documentation',
        version: '1.0.0',
      },
      externalDocs: {
        url: 'https://github.com/yourusername/neuroroute',
        description: 'Find more info here',
      },
      servers: [
        {
          url: `http://${host}:${port}`,
          description: 'Development server',
        }
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header'
          }
        }
      },
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'models', description: 'Model information endpoints' },
        { name: 'prompt', description: 'Prompt routing endpoints' },
      ],
    }
  });

  // Register Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
  });

  fastify.log.info('Swagger plugin registered');
};

export default swaggerPlugin;