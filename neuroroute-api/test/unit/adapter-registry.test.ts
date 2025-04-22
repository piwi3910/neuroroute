import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getModelAdapter, clearAdapterCache } from '../../src/models/adapter-registry.js';
import { BaseModelAdapter } from '../../src/models/base-adapter.js';

// Mock the model adapters
vi.mock('../../src/models/openai-adapter.js', () => ({
  default: vi.fn((fastify: any, modelId: string) => ({
    getModelId: () => modelId,
    provider: 'openai'
  }))
}));

vi.mock('../../src/models/anthropic-adapter.js', () => ({
  default: vi.fn((fastify: any, modelId: string) => ({
    getModelId: () => modelId,
    provider: 'anthropic'
  }))
}));

vi.mock('../../src/models/lmstudio-adapter.js', () => ({
  default: vi.fn((fastify: any, modelId: string) => ({
    getModelId: () => modelId,
    provider: 'lmstudio'
  }))
}));

describe('Adapter Registry', () => {
  const mockFastify = {
    log: {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    }
  } as any;

  beforeEach(() => {
    clearAdapterCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return OpenAI adapter for GPT models', () => {
    const adapter = getModelAdapter(mockFastify, 'gpt-4');
    expect(adapter.getModelId()).toBe('gpt-4');
    expect((adapter as any).provider).toBe('openai');
  });

  it('should return Anthropic adapter for Claude models', () => {
    const adapter = getModelAdapter(mockFastify, 'claude-3-opus');
    expect(adapter.getModelId()).toBe('claude-3-opus');
    expect((adapter as any).provider).toBe('anthropic');
  });

  it('should return LMStudio adapter for local models', () => {
    const adapter = getModelAdapter(mockFastify, 'lmstudio-local');
    expect(adapter.getModelId()).toBe('lmstudio-local');
    expect((adapter as any).provider).toBe('lmstudio');
  });

  it('should cache adapters and reuse them', () => {
    const adapter1 = getModelAdapter(mockFastify, 'gpt-4');
    const adapter2 = getModelAdapter(mockFastify, 'gpt-4');
    expect(adapter1).toBe(adapter2); // Same instance
  });

  it('should clear the cache when requested', () => {
    const adapter1 = getModelAdapter(mockFastify, 'gpt-4');
    clearAdapterCache();
    const adapter2 = getModelAdapter(mockFastify, 'gpt-4');
    expect(adapter1).not.toBe(adapter2); // Different instances
  });

  it('should default to OpenAI adapter for unknown models', () => {
    const adapter = getModelAdapter(mockFastify, 'unknown-model');
    expect(adapter.getModelId()).toBe('unknown-model');
    expect((adapter as any).provider).toBe('openai');
  });
});