import { FastifySchema } from 'fastify';
import { z } from 'zod';

/**
 * Zod schema for prompt request
 */
export const promptRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(10000, 'Prompt is too long'),
  model: z.string().optional(),
  options: z.object({
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional(),
    stream: z.boolean().optional(),
    costOptimize: z.boolean().optional(),
    qualityOptimize: z.boolean().optional(),
    latencyOptimize: z.boolean().optional(),
    fallbackEnabled: z.boolean().optional(),
    chainEnabled: z.boolean().optional(),
    cacheStrategy: z.enum(['default', 'aggressive', 'minimal', 'none']).optional(),
    cacheTTL: z.number().int().positive().optional(),
  }).optional(),
});

/**
 * Zod schema for prompt response
 */
export const promptResponseSchema = z.object({
  response: z.string(),
  model_used: z.string(),
  tokens: z.object({
    prompt: z.number().int().nonnegative(),
    completion: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  cached: z.boolean().optional(),
  classification: z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    features: z.array(z.string()).optional(),
    domain: z.string().optional(),
  }).optional(),
  processing_time: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  model_chain: z.array(z.string()).optional(),
});

/**
 * Zod schema for model configuration
 */
export const modelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  capabilities: z.array(z.string()),
  config: z.object({
    cost: z.number().nonnegative(),
    quality: z.number().min(0).max(1),
    maxTokens: z.number().int().positive(),
  }).and(z.record(z.string(), z.unknown())),
});

/**
 * Zod schema for API key
 */
export const apiKeySchema = z.object({
  provider: z.string(),
  key: z.string().min(1, 'API key cannot be empty'),
});

/**
 * Fastify schema for prompt endpoint
 */
export const promptRouteSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: { type: 'string', minLength: 1, maxLength: 10000 },
      model: { type: 'string' },
      options: {
        type: 'object',
        properties: {
          maxTokens: { type: 'integer', minimum: 1 },
          temperature: { type: 'number', minimum: 0, maximum: 2 },
          topP: { type: 'number', minimum: 0, maximum: 1 },
          frequencyPenalty: { type: 'number', minimum: -2, maximum: 2 },
          presencePenalty: { type: 'number', minimum: -2, maximum: 2 },
          stop: { type: 'array', items: { type: 'string' } },
          stream: { type: 'boolean' },
          costOptimize: { type: 'boolean' },
          qualityOptimize: { type: 'boolean' },
          latencyOptimize: { type: 'boolean' },
          fallbackEnabled: { type: 'boolean' },
          chainEnabled: { type: 'boolean' },
          cacheStrategy: { type: 'string', enum: ['default', 'aggressive', 'minimal', 'none'] },
          cacheTTL: { type: 'integer', minimum: 1 },
        },
      },
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
            prompt: { type: 'integer', minimum: 0 },
            completion: { type: 'integer', minimum: 0 },
            total: { type: 'integer', minimum: 0 },
          },
          required: ['prompt', 'completion', 'total'],
        },
        cached: { type: 'boolean' },
        classification: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            features: { type: 'array', items: { type: 'string' } },
            domain: { type: 'string' },
          },
          required: ['intent', 'confidence'],
        },
        processing_time: { type: 'number', minimum: 0 },
        cost: { type: 'number', minimum: 0 },
        model_chain: { type: 'array', items: { type: 'string' } },
      },
      required: ['response', 'model_used', 'tokens'],
    },
  },
};

/**
 * Fastify schema for models endpoint
 */
export const modelsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          provider: { type: 'string' },
          enabled: { type: 'boolean' },
          capabilities: { type: 'array', items: { type: 'string' } },
          contextWindow: { type: 'integer', minimum: 0 },
          maxTokens: { type: 'integer', minimum: 0 },
          available: { type: 'boolean' },
        },
        required: ['id', 'name', 'provider', 'enabled', 'capabilities', 'available'],
      },
    },
  },
};

/**
 * Fastify schema for model configuration endpoint
 */
export const modelConfigRouteSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['id', 'name', 'provider', 'enabled', 'capabilities', 'config'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      provider: { type: 'string' },
      enabled: { type: 'boolean' },
      priority: { type: 'integer', minimum: 0 },
      capabilities: { type: 'array', items: { type: 'string' } },
      config: {
        type: 'object',
        required: ['cost', 'quality', 'maxTokens'],
        properties: {
          cost: { type: 'number', minimum: 0 },
          quality: { type: 'number', minimum: 0, maximum: 1 },
          maxTokens: { type: 'integer', minimum: 1 },
        },
        additionalProperties: true,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
      required: ['success'],
    },
  },
};

/**
 * Fastify schema for API key endpoint
 */
export const apiKeyRouteSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['provider', 'key'],
    properties: {
      provider: { type: 'string' },
      key: { type: 'string', minLength: 1 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
      required: ['success'],
    },
  },
};

/**
 * Validate a request against a Zod schema
 * 
 * @param schema Zod schema
 * @param data Data to validate
 * @returns Validated data or throws an error
 */
export function validateWithZod<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validate a prompt request
 * 
 * @param data Request data
 * @returns Validated request data
 */
export function validatePromptRequest(data: unknown) {
  return validateWithZod(promptRequestSchema, data);
}

/**
 * Validate a prompt response
 * 
 * @param data Response data
 * @returns Validated response data
 */
export function validatePromptResponse(data: unknown) {
  return validateWithZod(promptResponseSchema, data);
}

/**
 * Validate a model configuration
 * 
 * @param data Model configuration data
 * @returns Validated model configuration
 */
export function validateModelConfig(data: unknown) {
  return validateWithZod(modelConfigSchema, data);
}

/**
 * Validate an API key
 * 
 * @param data API key data
 * @returns Validated API key
 */
export function validateApiKey(data: unknown) {
  return validateWithZod(apiKeySchema, data);
}