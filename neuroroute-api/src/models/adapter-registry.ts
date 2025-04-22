import { FastifyInstance } from 'fastify';
import { BaseModelAdapter, ModelAdapterFactory } from './base-adapter.js';
import createOpenAIAdapter from './openai-adapter.js';
import createAnthropicAdapter from './anthropic-adapter.js';
import createLMStudioAdapter from './lmstudio-adapter.js';

// Map of provider prefixes to adapter factory functions
const providerMap: Record<string, ModelAdapterFactory> = {
  'openai': createOpenAIAdapter as ModelAdapterFactory,
  'gpt': createOpenAIAdapter as ModelAdapterFactory,
  'anthropic': createAnthropicAdapter as ModelAdapterFactory,
  'claude': createAnthropicAdapter as ModelAdapterFactory,
  'lmstudio': createLMStudioAdapter as ModelAdapterFactory,
  'local': createLMStudioAdapter as ModelAdapterFactory,
};

// Cache of model adapters to avoid recreating them for each request
const adapterCache = new Map<string, BaseModelAdapter>();

/**
 * Get the appropriate model adapter for a model ID
 * @param fastify Fastify instance
 * @param modelId Model ID
 * @returns Model adapter
 */
export function getModelAdapter(fastify: FastifyInstance, modelId: string): BaseModelAdapter {
  // Check if adapter is already cached
  if (adapterCache.has(modelId)) {
    return adapterCache.get(modelId)!;
  }

  // Determine provider from model ID
  let provider = 'openai'; // Default provider
  
  if (modelId.includes('gpt')) {
    provider = 'openai';
  } else if (modelId.includes('claude')) {
    provider = 'anthropic';
  } else if (modelId.includes('lmstudio') || modelId.includes('local')) {
    provider = 'local';
  }
  
  // Get the appropriate adapter factory
  const adapterFactory = providerMap[provider];
  
  if (!adapterFactory) {
    fastify.log.error({ modelId }, 'No adapter factory found for model');
    throw new Error(`No adapter factory found for model ${modelId}`);
  }
  
  // Create the adapter
  const adapter = adapterFactory(fastify, modelId);
  
  // Cache the adapter
  adapterCache.set(modelId, adapter);
  
  return adapter;
}

/**
 * Clear the adapter cache
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}

/**
 * Get all cached adapters
 * @returns Map of model IDs to adapters
 */
export function getCachedAdapters(): Map<string, BaseModelAdapter> {
  return new Map(adapterCache);
}

export default {
  getModelAdapter,
  clearAdapterCache,
  getCachedAdapters
};