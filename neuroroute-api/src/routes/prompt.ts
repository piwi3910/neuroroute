import { FastifyPluginAsync } from 'fastify';
import createRouterService from '../services/router.js';

/**
 * Prompt routing endpoint
 *
 * This endpoint routes prompts to the appropriate model based on
 * intent classification and model capabilities.
 */
const promptRoutes: FastifyPluginAsync = async (fastify) => {
  // Create router service
  const routerService = createRouterService(fastify);
  
  // Create route options
  const routeOptions: any = {
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
    handler: async (request: any, reply: any) => {
      const startTime = Date.now();
      
      try {
        const { prompt, model_id, max_tokens = 1024, temperature = 0.7 } = request.body as {
          prompt: string;
          model_id?: string;
          max_tokens?: number;
          temperature?: number;
        };

        // Validate prompt
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
          reply.code(400);
          return {
            error: 'Prompt is required and must be a non-empty string',
            code: 'INVALID_PROMPT',
            requestId: request.id,
          };
        }
        
        // Log request
        request.log.info({
          promptLength: prompt.length,
          modelId: model_id,
          maxTokens: max_tokens,
          temperature,
          apiKeyId: request.apiKey?.id,
        }, 'Processing prompt');
        
        // Use router service to process the prompt
        const result = await routerService.routePrompt(
          prompt,
          model_id,
          max_tokens,
          temperature
        );
        
        const processingTime = (Date.now() - startTime) / 1000;
        
        // Add processing time to the response
        const response = {
          ...result,
          processing_time: processingTime,
          request_id: request.id,
        };
        
        // Log response
        request.log.info({
          modelUsed: result.model_used,
          tokens: result.tokens,
          processingTime,
        }, 'Prompt processed successfully');
        
        return response;
      } catch (error: unknown) {
        // Log error
        request.log.error(error, 'Error processing prompt');
        
        // Determine status code and error details
        let statusCode = 500;
        let errorMessage = 'An error occurred while processing the prompt';
        let errorCode = 'INTERNAL_ERROR';
        
        // Handle known error types
        if (error && typeof error === 'object') {
          if ('statusCode' in error && typeof error.statusCode === 'number') {
            statusCode = error.statusCode;
          }
          
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          }
          
          if ('code' in error && typeof error.code === 'string') {
            errorCode = error.code;
          }
        }
        
        reply.code(statusCode);
        
        // Return error response
        return {
          error: errorMessage,
          code: errorCode,
          request_id: request.id,
        };
      }
    },
  };
  
  // Add authentication if available
  if (fastify.hasDecorator('authenticate')) {
    routeOptions.onRequest = [fastify.authenticate];
  }
  
  // Register the route
  fastify.post('/', routeOptions);
};

export default promptRoutes;