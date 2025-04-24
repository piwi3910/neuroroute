import { FastifyPluginAsync, FastifyRequest, FastifyReply, RouteOptions, RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression } from 'fastify';
import process from 'node:process'; // Explicitly import process for ESM compatibility
// Assuming types exist, adjust imports as needed later
import { PreprocessorService } from '../services/preprocessor/interfaces.js';
import { ClassifierService, ClassifiedIntent } from '../services/classifier/interfaces.js';
import { RoutingEngine, NormalizationEngine, RoutingOptions, RoutingResult, NormalizationOptions, ModelResponse } from '../services/router/interfaces.js'; // Import Router types
import AdapterRegistryDefault from '../models/adapter-registry.js'; // Use default import
// import { ApiKey } from '@prisma/client'; // Don't use full Prisma type here
// Remove temporary import

// Define interfaces for request body and response
interface PromptRequestBody {
  prompt: string;
  model_id?: string;
  max_tokens?: number;
  temperature?: number;
  // Add any other options passed to services
  [key: string]: any;
}

interface PromptResponseBody {
  response: string;
  model_used: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  processing_time: {
    total: number;
    preprocessing?: number;
    classification?: number;
    routing?: number;
    normalization?: number;
    model_generation?: number;
  };
  classification?: ClassifiedIntent; // Use specific type
  request_id: string;
}

interface ErrorResponseBody {
  error: string;
  code: string;
  request_id: string;
}

// Extend Fastify interfaces with decorators if not done globally
declare module 'fastify' {
  interface FastifyInstance {
    preprocessor: PreprocessorService;
    classifier: ClassifierService;
    router: {
      routing: RoutingEngine;
      normalization: NormalizationEngine;
    };
    models: typeof AdapterRegistryDefault; // Use typeof default import
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>; // Make required
  }
  interface FastifyRequest {
    // Use the type defined in auth.ts plugin
    apiKey?: {
      id: string;
      name: string;
      permissions: string[];
     };
     // Add userData if needed based on auth plugin
     userData?: {
      id: string;
      username: string;
      email: string;
      roles: string[];
      permissions: string[];
    };
  }
}


/**
 * Prompt routing endpoint using the new flow architecture.
 */
const promptRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Define shared schema components
  const bodySchema = {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: { type: 'string', description: 'The user prompt' },
      model_id: { type: 'string', description: 'Optional specific model ID override' },
      max_tokens: { type: 'integer', description: 'Maximum tokens to generate' },
      temperature: { type: 'number', description: 'Sampling temperature' },
      // Add other potential options here like classifier options
      classifierOptions: { 
        type: 'object', 
        properties: {
          detailed: { type: 'boolean' },
          maxConfidence: { type: 'number' },
          minConfidence: { type: 'number' },
          prioritizeFeatures: { type: 'array', items: { type: 'string' } }
        },
        additionalProperties: false,
        description: 'Options for the classification stage'
      },
      // Add routing options if they need to be passed in the body
      routingOptions: {
        type: 'object',
        properties: {
            costOptimize: { type: 'boolean' },
            qualityOptimize: { type: 'boolean' },
            latencyOptimize: { type: 'boolean' },
            fallbackEnabled: { type: 'boolean' },
            chainEnabled: { type: 'boolean' },
            cacheStrategy: { type: 'string', enum: ['default', 'aggressive', 'minimal', 'none'] },
            cacheTTL: { type: 'number' },
            fallbackLevels: { type: 'number' },
            degradedMode: { type: 'boolean' },
            timeoutMs: { type: 'number' },
            monitorFallbacks: { type: 'boolean' },
        },
        additionalProperties: true, // Allow other routing options
        description: 'Options for the routing stage'
      },
      // Add normalization options if needed
      normalizationOptions: {
        type: 'object',
        properties: {
            // Define specific normalization options if any
        },
         additionalProperties: true,
         description: 'Options for the normalization stage'
      }
    },
    additionalProperties: true, // Allow other options for services
  };

  const successResponseSchema = {
    type: 'object',
    properties: {
      response: { type: 'string' },
      model_used: { type: 'string' },
      classification: { 
        type: 'object', 
        properties: { // Define properties based on ClassifiedIntent
          type: { type: 'string' },
          complexity: { type: 'string', enum: ['simple', 'medium', 'complex', 'very-complex'] },
          features: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'number' },
          tokens: { 
            type: 'object', 
            properties: { 
              estimated: { type: 'integer' }, 
              completion: { type: 'integer' } 
            },
            required: ['estimated', 'completion']
          },
          domain: { type: 'string' },
          language: { type: 'string' }
        },
        required: ['type', 'complexity', 'features', 'priority', 'confidence', 'tokens'],
        additionalProperties: false, 
        description: 'Classification results' 
      },
      tokens: {
        type: 'object',
        properties: {
          prompt: { type: 'integer' },
          completion: { type: 'integer' },
          total: { type: 'integer' },
        },
         required: ['prompt', 'completion', 'total']
      },
      processing_time: {
        type: 'object',
        properties: {
          total: { type: 'number' },
          preprocessing: { type: 'number' },
          classification: { type: 'number' },
          routing: { type: 'number' },
          normalization: { type: 'number' },
          model_generation: { type: 'number' },
        },
        required: ['total']
       },
       request_id: { type: 'string' },
    },
     required: ['response', 'model_used', 'tokens', 'processing_time', 'request_id'] // Classification might be optional depending on flow
  };

  const errorResponseSchema = {
    type: 'object',
    properties: {
      error: { type: 'string' },
      code: { type: 'string' },
      request_id: { type: 'string' },
    },
     required: ['error', 'code', 'request_id']
  };

  // Define route options with correct type, including Body generic
  const routeOptions: RouteOptions<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    { Body: PromptRequestBody }, // Specify Body type here
    unknown // Use default context
  > = {
    method: 'POST', // Explicitly define method for RouteOptions
    url: '/',       // Explicitly define url for RouteOptions
    schema: {
      description: 'Route a prompt using the full processing pipeline',
      tags: ['prompt'],
      body: bodySchema,
      response: {
        200: successResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema,
        // Add other potential error codes (401, 403, 429, etc.)
      },
    },
    handler: async (request: FastifyRequest<{ Body: PromptRequestBody }>, reply: FastifyReply): Promise<PromptResponseBody | ErrorResponseBody> => {
      const handlerStartTime = process.hrtime.bigint();
      const timings = {
        preprocessing: 0,
        classification: 0,
        routing: 0,
        normalization: 0,
        model_generation: 0,
      };

      // Declare variables in the handler scope
      let preprocessedPrompt = ''; 
      let classification: ClassifiedIntent | undefined;
      let routingResult: RoutingResult | undefined; 
      let normalizedPrompt: string | undefined; 
      let modelResponse: ModelResponse | undefined;

      try {
        // Extract options relevant for services, separate from model params
        const { 
          prompt, 
          model_id, // User override for model
          max_tokens = 1024, 
          temperature = 0.7, 
          classifierOptions, 
          routingOptions, 
          normalizationOptions, // Extract normalization options
          ...modelParams // Remaining options are assumed to be model parameters
        } = request.body;

        // Validate prompt
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
          reply.code(400);
          return {
            error: 'Prompt is required and must be a non-empty string',
            code: 'INVALID_PROMPT',
            request_id: request.id, 
          };
        }
        
        request.log.info({
          promptLength: prompt.length,
          requestedModelId: model_id,
          maxTokens: max_tokens,
          temperature,
          classifierOptions,
          routingOptions,
          normalizationOptions,
          modelParams,
          apiKeyId: request.apiKey?.id,
        }, 'Processing prompt request');

        // --- Preprocessing Stage ---
        const preprocessStartTime = process.hrtime.bigint();
        preprocessedPrompt = await fastify.preprocessor.process(prompt, modelParams); 
        timings.preprocessing = Number(process.hrtime.bigint() - preprocessStartTime) / 1e6; // ms
        request.log.debug({ preprocessedPrompt, durationMs: timings.preprocessing }, 'Preprocessing complete');
        
        // --- Classification Stage ---
        const classifyStartTime = process.hrtime.bigint();
        classification = await fastify.classifier.classifyPrompt(preprocessedPrompt, classifierOptions); 
        timings.classification = Number(process.hrtime.bigint() - classifyStartTime) / 1e6; // ms
        request.log.debug({ classification, durationMs: timings.classification }, 'Classification complete');

        // --- Routing Stage ---
        const routeStartTime = process.hrtime.bigint();
        if (!classification) { 
            throw new Error('Classification result is undefined before routing');
        }
        routingResult = await fastify.router.routing.route(preprocessedPrompt, classification, routingOptions as RoutingOptions);
        timings.routing = Number(process.hrtime.bigint() - routeStartTime) / 1e6; // ms
        request.log.debug({ routingResult, durationMs: timings.routing }, 'Routing complete');

        // --- Normalization Stage ---
        const normalizeStartTime = process.hrtime.bigint();
        if (!routingResult) { 
             throw new Error('Routing result is undefined before normalization');
        }
        normalizedPrompt = await fastify.router.normalization.normalize(preprocessedPrompt, routingResult.modelId, normalizationOptions as NormalizationOptions);
        timings.normalization = Number(process.hrtime.bigint() - normalizeStartTime) / 1e6; // ms
        request.log.debug({ normalizedPrompt, durationMs: timings.normalization }, 'Normalization complete');

        // --- Model Generation Stage ---
        const modelCallStartTime = process.hrtime.bigint();
        if (!normalizedPrompt) { 
             throw new Error('Normalized prompt is undefined before model call');
        }
        // Use the model_id from routing, but allow user override if provided
        const targetModelId = model_id || routingResult.modelId; 
        const adapter = fastify.models.getModelAdapter(fastify, targetModelId);
        if (!adapter) {
            throw new Error(`Could not find adapter for model: ${targetModelId}`);
        }
        
        // Prepare model options, combining defaults, routing results, and user inputs
        const finalModelParams = {
            max_tokens,
            temperature,
            ...modelParams // Include any other params passed in the body
        };

        // TODO: Handle different adapter methods (e.g., generateCompletion vs chatCompletion) based on adapter capabilities or request type
        // Assuming generateCompletion for now
        modelResponse = await adapter.generateCompletion(normalizedPrompt, finalModelParams);
        timings.model_generation = Number(process.hrtime.bigint() - modelCallStartTime) / 1e6; // ms
        request.log.debug({ modelResponse, durationMs: timings.model_generation }, 'Model generation complete');
        // --- End Model Generation Stage ---

        const handlerEndTime = process.hrtime.bigint();
        const totalProcessingTime = Number(handlerEndTime - handlerStartTime) / 1e6; // ms

        if (!modelResponse) {
            throw new Error('Model response is undefined');
        }

        const response: PromptResponseBody = {
          response: modelResponse.text || '', // Adjust based on actual ModelResponse structure
          model_used: targetModelId, 
          tokens: modelResponse.tokens || { prompt: 0, completion: 0, total: 0 }, // Provide default
          classification: classification, 
          processing_time: {
            total: totalProcessingTime,
            preprocessing: timings.preprocessing,
            classification: timings.classification, 
            routing: timings.routing, 
            normalization: timings.normalization, 
            model_generation: timings.model_generation 
          },
          request_id: request.id,
        };
        
        request.log.info({
          modelUsed: response.model_used,
          tokens: response.tokens,
          totalProcessingTimeMs: totalProcessingTime,
          timings,
        }, 'Prompt processed successfully');
        
        return response;

      } catch (error: unknown) {
        const handlerEndTime = process.hrtime.bigint();
        const totalProcessingTime = Number(handlerEndTime - handlerStartTime) / 1e6; // ms
        request.log.error({ 
          error, 
          totalProcessingTimeMs: totalProcessingTime, 
          timings,
          preprocessedPrompt: preprocessedPrompt || 'N/A', 
          classification: classification || 'N/A',
          routingResult: routingResult || 'N/A',
          normalizedPrompt: normalizedPrompt || 'N/A',
          modelResponse: modelResponse || 'N/A' // Log model response on error if available
        }, 'Error processing prompt');
        
        let statusCode = 500;
        let errorMessage = 'An error occurred during prompt processing';
        let errorCode = 'PROMPT_PROCESSING_FAILED';
        
        if (error instanceof Error) {
            errorMessage = error.message;
            // Check for specific error types/codes if services throw custom errors
            if ('code' in error && typeof error.code === 'string') {
              errorCode = error.code;
            }
             if ('statusCode' in error && typeof error.statusCode === 'number') {
              statusCode = error.statusCode;
            }
        } else {
            errorMessage = 'An unknown error occurred';
        }

        reply.code(statusCode);
        
        return {
          error: errorMessage,
          code: errorCode,
          request_id: request.id,
        };
      }
    },
    // Conditionally add onRequest hook INSIDE the object definition
    ...(fastify.authenticate ? { onRequest: [fastify.authenticate] } : {}),
  }; // End of routeOptions object literal
  
  // Register the route using fastify.route for full RouteOptions compatibility
  fastify.route(routeOptions); 
}; // End of plugin function

export default promptRoutes;