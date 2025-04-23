/**
 * Unit tests for the classifier service
 */

import { createClassifierService } from '../../src/services/classifier/index.js';
import { jest, describe, it, expect, beforeEach } from '../../test/jest-setup.js';
import { ClassifierRegistry } from '../../src/services/classifier/interfaces.js';

describe('Classifier Service', () => {
  // Mock Fastify instance
  const mockFastify = {
    log: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  };

  // Mock registry
  const mockRegistry: Partial<ClassifierRegistry> = {
    register: jest.fn(),
    classify: jest.fn<(prompt: string, options?: any) => Promise<any>>().mockResolvedValue({
      type: 'test',
      complexity: 'simple',
      features: ['test-feature'],
      priority: 'medium',
      confidence: 0.8,
      tokens: {
        estimated: 10,
        completion: 20
      }
    }),
    setDefault: jest.fn()
  };

  // Mock the registry creation
  jest.mock('../../src/services/classifier/registry.js', () => ({
    createClassifierRegistry: jest.fn().mockReturnValue(mockRegistry)
  }));

  // Mock the rules-based classifier
  const mockRulesBasedClassifier = {
    name: 'rules-based',
    isEnabled: jest.fn<() => boolean>().mockReturnValue(true),
    classify: jest.fn<(prompt: string, options?: any) => Promise<any>>().mockResolvedValue({
      type: 'test-rules',
      complexity: 'medium',
      features: ['rules-feature'],
      priority: 'high',
      confidence: 0.9,
      tokens: {
        estimated: 30,
        completion: 40
      }
    })
  };

  // Mock the ML-based classifier
  const mockMlBasedClassifier = {
    name: 'ml-based',
    isEnabled: jest.fn<() => boolean>().mockReturnValue(false),
    classify: jest.fn<(prompt: string, options?: any) => Promise<any>>().mockResolvedValue({
      type: 'test-ml',
      complexity: 'complex',
      features: ['ml-feature'],
      priority: 'high',
      confidence: 0.95,
      tokens: {
        estimated: 50,
        completion: 60
      }
    })
  };

  // Mock the classifier creation functions
  jest.mock('../../src/services/classifier/classifiers/rules-based.js', () => ({
    createRulesBasedClassifier: jest.fn().mockReturnValue(mockRulesBasedClassifier)
  }));

  jest.mock('../../src/services/classifier/classifiers/ml-based.js', () => ({
    createMlBasedClassifier: jest.fn().mockReturnValue(mockMlBasedClassifier)
  }));

  it('should create a classifier service with the registry', () => {
    const service = createClassifierService(mockFastify as any);
    
    expect(service.registry).toBeDefined();
    expect(mockRegistry.register).toHaveBeenCalledWith(mockRulesBasedClassifier);
    expect(mockRegistry.setDefault).toHaveBeenCalledWith(mockRulesBasedClassifier.name);
  });

  it('should register both rules-based and ml-based classifiers', () => {
    const service = createClassifierService(mockFastify as any);
    
    expect(mockRegistry.register).toHaveBeenCalledWith(mockRulesBasedClassifier);
    expect(mockRegistry.register).toHaveBeenCalledWith(mockMlBasedClassifier);
  });

  it('should classify prompts using the registry', async () => {
    const service = createClassifierService(mockFastify as any);
    const prompt = 'test prompt';
    const options = { detailed: true };
    
    await service.classifyPrompt(prompt, options);
    
    expect(mockRegistry.classify).toHaveBeenCalledWith(prompt, options);
  });

  it('should handle errors during classification', async () => {
    // Mock registry to throw an error
    mockRegistry.classify = jest.fn<(prompt: string, options?: any) => Promise<any>>().mockRejectedValue(new Error('Test error'));
    
    const service = createClassifierService(mockFastify as any);
    const prompt = 'test prompt';
    
    const result = await service.classifyPrompt(prompt);
    
    expect(result).toBeDefined();
    expect(result.type).toBe('general');
    expect(result.complexity).toBe('medium');
    expect(result.confidence).toBe(0.5);
    expect(mockFastify.log.error).toHaveBeenCalled();
  });
});