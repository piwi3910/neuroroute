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
          id: 'gpt-4.1',
          name: 'GPT-4.1',
          provider: 'OpenAI',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
        },
        {
          id: 'claude-3-7-sonnet-latest',
          name: 'Claude 3.7 Sonnet',
          provider: 'Anthropic',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
        },
        {
          id: 'lmstudio-local',
          name: 'LM Studio Local',
          provider: 'Local',
          capabilities: ['text-generation', 'code-generation'],
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
        'gpt-4.1': {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
          provider: 'OpenAI',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
          details: {
            contextWindow: 8192,
            tokenLimit: 4096,
            version: '0423',
          },
        },
        'claude-3-7-sonnet-latest': {
          id: 'claude-3-7-sonnet-latest',
          name: 'Claude 3.7 Sonnet',
          provider: 'Anthropic',
          capabilities: ['text-generation', 'code-generation', 'reasoning'],
          status: 'available',
          details: {
            contextWindow: 200000,
            tokenLimit: 4096,
            version: '3.7',
          },
        },
        'lmstudio-local': {
          id: 'lmstudio-local',
          name: 'LM Studio Local',
          provider: 'Local',
          capabilities: ['text-generation', 'code-generation'],
          status: 'available',
          details: {
            contextWindow: 4096,
            tokenLimit: 2048,
            version: 'local',
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