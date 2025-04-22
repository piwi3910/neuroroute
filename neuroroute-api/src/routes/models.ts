import { FastifyPluginAsync } from 'fastify';

// Model information endpoint
const modelsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Get information about available models',
      tags: ['models'],
      response: {
        200: {
          type: 'object',
          properties: {
            models: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  provider: { type: 'string' },
                  capabilities: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      // In a real implementation, this would come from a service or database
      const models = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'OpenAI',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'Anthropic',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
        },
      ];

      return { models };
    },
  });

  // Get specific model information
  fastify.get('/:id', {
    schema: {
      description: 'Get information about a specific model',
      tags: ['models'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Model ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            provider: { type: 'string' },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
            },
            status: { type: 'string' },
            details: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      // Define model interface for type safety
      interface ModelInfo {
        id: string;
        name: string;
        provider: string;
        capabilities: string[];
        status: string;
        details: {
          contextWindow: number;
          tokenLimit: number;
          version: string;
        };
      }

      // In a real implementation, this would come from a service or database
      const models: Record<string, ModelInfo> = {
        'gpt-4': {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'OpenAI',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
          details: {
            contextWindow: 8192,
            tokenLimit: 4096,
            version: '0422',
          },
        },
        'claude-3-opus': {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'Anthropic',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
          details: {
            contextWindow: 100000,
            tokenLimit: 4096,
            version: '1.0',
          },
        },
      };

      const model = models[id];
      if (!model) {
        reply.code(404);
        return { error: `Model with ID ${id} not found` };
      }

      return model;
    },
  });
};

export default modelsRoutes;