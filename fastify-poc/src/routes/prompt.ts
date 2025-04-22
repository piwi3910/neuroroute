import { FastifyPluginAsync } from 'fastify';

// Prompt routing endpoint
const promptRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', {
    schema: {
      description: 'Route a prompt to the appropriate model',
      tags: ['prompt'],
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', description: 'The user prompt' },
          model_id: { type: 'string', description: 'Optional specific model ID to use' },
          max_tokens: { type: 'integer', description: 'Maximum tokens to generate' },
          temperature: { type: 'number', description: 'Sampling temperature' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            response: { type: 'string' },
            model_used: { type: 'string' },
            tokens: {
              type: 'object',
              properties: {
                prompt: { type: 'integer' },
                completion: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
            processing_time: { type: 'number' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const startTime = Date.now();
      
      try {
        const { prompt, model_id, max_tokens = 1024, temperature = 0.7 } = request.body as {
          prompt: string;
          model_id?: string;
          max_tokens?: number;
          temperature?: number;
        };

        // In a real implementation, this would use the router service to:
        // 1. Classify the prompt
        // 2. Select the appropriate model
        // 3. Send the prompt to the model
        // 4. Return the response

        // For this proof of concept, we'll just simulate a response
        const selectedModel = model_id || 'gpt-4';
        const simulatedResponse = `This is a simulated response to: "${prompt}"`;
        
        // Simulate token counting
        const promptTokens = Math.ceil(prompt.length / 4);
        const completionTokens = Math.ceil(simulatedResponse.length / 4);
        
        const processingTime = (Date.now() - startTime) / 1000;

        return {
          response: simulatedResponse,
          model_used: selectedModel,
          tokens: {
            prompt: promptTokens,
            completion: completionTokens,
            total: promptTokens + completionTokens,
          },
          processing_time: processingTime,
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return {
          error: 'An error occurred while processing the prompt',
        };
      }
    },
  });
};

export default promptRoutes;