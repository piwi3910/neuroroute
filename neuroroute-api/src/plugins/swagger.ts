import { FastifyPluginAsync } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';

// Swagger configuration plugin
const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Use type assertion to access config property
  const config = (fastify as any).config ?? {};
  const host = config.HOST ?? 'localhost';
  const port = config.PORT ?? 3000;
  const nodeEnv = config.NODE_ENV ?? 'development';

  // Register Swagger UI
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'NeuroRoute API',
        description: `
# NeuroRoute API Documentation

NeuroRoute is an intelligent routing system for LLM requests, directing prompts to the most appropriate model based on content analysis.

## Features

- **Model Selection**: Automatically routes requests to the most appropriate AI model
- **Caching**: Optimizes response times with intelligent caching
- **Rate Limiting**: Protects the API from abuse
- **Monitoring**: Comprehensive metrics and monitoring
- **Authentication**: Secure API access with API keys

## Authentication

Most endpoints require authentication using an API key. Include your API key in the request header:

\`\`\`
X-API-Key: your-api-key
\`\`\`

## Rate Limiting

The API implements rate limiting to ensure fair usage. Rate limits vary by endpoint:
- Standard endpoints: ${config.RATE_LIMIT_MAX || 100} requests per ${(config.RATE_LIMIT_WINDOW || 60000)/1000} seconds
- Prompt endpoints: ${config.PROMPT_RATE_LIMIT_MAX || 20} requests per ${(config.PROMPT_RATE_LIMIT_WINDOW || 60000)/1000} seconds
- Admin endpoints: ${config.ADMIN_RATE_LIMIT_MAX || 50} requests per ${(config.ADMIN_RATE_LIMIT_WINDOW || 60000)/1000} seconds

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests in the current window
- \`X-RateLimit-Reset\`: Time when the rate limit resets (Unix timestamp)
        `,
        version: process.env.npm_package_version ?? '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
          url: 'https://example.com/support',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      externalDocs: {
        url: 'https://github.com/yourusername/neuroroute',
        description: 'Find more info here',
      },
      servers: [
        {
          url: config.API_URL ?? `http://${host}:${port}`,
          description: nodeEnv === 'production' ? 'Production server' : 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
            description: 'API key for authentication',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          HealthResponse: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
              version: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string', enum: ['ok', 'error'] },
                  cache: { type: 'string', enum: ['ok', 'error'] },
                  models: {
                    type: 'object',
                    additionalProperties: {
                      type: 'string',
                      enum: ['ok', 'error', 'unavailable'],
                    },
                  },
                },
              },
              uptime: { type: 'number' },
              memory: {
                type: 'object',
                properties: {
                  rss: { type: 'number' },
                  heapTotal: { type: 'number' },
                  heapUsed: { type: 'number' },
                  external: { type: 'number' },
                },
              },
            },
          },
          ModelList: {
            type: 'object',
            properties: {
              models: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Model',
                },
              },
            },
          },
          Model: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              capabilities: {
                type: 'array',
                items: { type: 'string' },
              },
              maxTokens: { type: 'integer' },
              status: { type: 'string', enum: ['available', 'unavailable'] },
              costPer1kTokens: {
                type: 'object',
                properties: {
                  input: { type: 'number' },
                  output: { type: 'number' },
                },
              },
            },
          },
          PromptRequest: {
            type: 'object',
            required: ['prompt'],
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              maxTokens: { type: 'integer' },
              temperature: { type: 'number' },
              stream: { type: 'boolean' },
              options: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
          PromptResponse: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              model: { type: 'string' },
              response: { type: 'string' },
              promptTokens: { type: 'integer' },
              completionTokens: { type: 'integer' },
              totalTokens: { type: 'integer' },
              cost: { type: 'number' },
              cached: { type: 'boolean' },
              processingTime: { type: 'number' },
            },
          },
        },
        responses: {
          Error: {
            description: 'Error response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          Unauthorized: {
            description: 'Authentication information is missing or invalid',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          TooManyRequests: {
            description: 'Rate limit exceeded',
            headers: {
              'X-RateLimit-Limit': {
                schema: { type: 'integer' },
                description: 'Request limit per time window',
              },
              'X-RateLimit-Remaining': {
                schema: { type: 'integer' },
                description: 'Remaining requests in the current time window',
              },
              'X-RateLimit-Reset': {
                schema: { type: 'integer' },
                description: 'Unix timestamp when the rate limit resets',
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'models', description: 'Model information endpoints' },
        { name: 'prompt', description: 'Prompt routing endpoints' },
        { name: 'admin', description: 'Administrative endpoints' },
        { name: 'dashboard', description: 'Dashboard data endpoints' },
      ],
      security: [
        { apiKey: [] },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: config.SWAGGER_ROUTE ?? '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
    theme: {
      title: 'NeuroRoute API Documentation',
    },
  });

  // Add hook to include API version in all responses
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (!reply.hasHeader('X-API-Version')) {
      reply.header('X-API-Version', process.env.npm_package_version ?? '1.0.0');
    }
    return payload;
  });

  fastify.log.info('Swagger plugin registered with enhanced documentation');
};

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '4.x',
  dependencies: ['@fastify/env'],
});