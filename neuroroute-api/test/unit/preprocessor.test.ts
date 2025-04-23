/**
 * Preprocessor Service Unit Tests
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import '../setup.js';
import { createPreprocessorService } from '../../src/services/preprocessor/index.js';
import { Preprocessor, PreprocessorOptions } from '../../src/services/preprocessor/interfaces.js';

// Extend the PreprocessorOptions interface for testing
declare module '../../src/services/preprocessor/interfaces.js' {
  interface PreprocessorOptions {
    mock?: {
      enabled?: boolean;
      prefix?: string;
    };
  }
}

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger.js', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('Preprocessor Service', () => {
  let preprocessorService: ReturnType<typeof createPreprocessorService>;
  
  beforeEach(() => {
    preprocessorService = createPreprocessorService();
  });
  
  it('should create a preprocessor service', () => {
    expect(preprocessorService).toBeDefined();
    expect(typeof preprocessorService.process).toBe('function');
    expect(typeof preprocessorService.registerPreprocessor).toBe('function');
    expect(typeof preprocessorService.getPreprocessor).toBe('function');
    expect(typeof preprocessorService.getAllPreprocessors).toBe('function');
  });
  
  it('should register and retrieve preprocessors', () => {
    // Create a mock preprocessor
    const mockPreprocessor: Preprocessor = {
      name: 'mock',
      isEnabled: () => true,
      process: async (prompt) => `${prompt}-processed`
    };
    
    // Register the preprocessor
    preprocessorService.registerPreprocessor(mockPreprocessor);
    
    // Get the preprocessor
    const retrievedPreprocessor = preprocessorService.getPreprocessor('mock');
    
    // Verify the preprocessor was registered and retrieved correctly
    expect(retrievedPreprocessor).toBeDefined();
    expect(retrievedPreprocessor?.name).toBe('mock');
    
    // Get all preprocessors
    const allPreprocessors = preprocessorService.getAllPreprocessors();
    
    // Verify all preprocessors includes our mock preprocessor
    expect(allPreprocessors).toContainEqual(mockPreprocessor);
  });
  
  it('should process a prompt through registered preprocessors', async () => {
    // Create mock preprocessors
    const mockPreprocessor1: Preprocessor = {
      name: 'mock1',
      isEnabled: () => true,
      process: async (prompt) => `${prompt}-1`
    };
    
    const mockPreprocessor2: Preprocessor = {
      name: 'mock2',
      isEnabled: () => true,
      process: async (prompt) => `${prompt}-2`
    };
    
    // Register the preprocessors
    preprocessorService.registerPreprocessor(mockPreprocessor1);
    preprocessorService.registerPreprocessor(mockPreprocessor2);
    
    // Process a prompt
    const result = await preprocessorService.process('test');
    
    // Verify the prompt was processed by both preprocessors
    expect(result).toBe('test-1-2');
  });
  
  it('should skip disabled preprocessors', async () => {
    // Create mock preprocessors
    const mockPreprocessor1: Preprocessor = {
      name: 'mock1',
      isEnabled: () => true,
      process: async (prompt) => `${prompt}-1`
    };
    
    const mockPreprocessor2: Preprocessor = {
      name: 'mock2',
      isEnabled: () => false, // This one is disabled
      process: async (prompt) => `${prompt}-2`
    };
    
    // Register the preprocessors
    preprocessorService.registerPreprocessor(mockPreprocessor1);
    preprocessorService.registerPreprocessor(mockPreprocessor2);
    
    // Process a prompt
    const result = await preprocessorService.process('test');
    
    // Verify the prompt was processed only by the enabled preprocessor
    expect(result).toBe('test-1');
  });
  
  it('should handle errors in preprocessors', async () => {
    // Create mock preprocessors
    const mockPreprocessor1: Preprocessor = {
      name: 'mock1',
      isEnabled: () => true,
      process: async () => { throw new Error('Test error'); }
    };
    
    const mockPreprocessor2: Preprocessor = {
      name: 'mock2',
      isEnabled: () => true,
      process: async (prompt) => `${prompt}-2`
    };
    
    // Register the preprocessors
    preprocessorService.registerPreprocessor(mockPreprocessor1);
    preprocessorService.registerPreprocessor(mockPreprocessor2);
    
    // Process a prompt
    const result = await preprocessorService.process('test');
    
    // Verify the prompt was processed by the second preprocessor despite the error in the first
    expect(result).toBe('test-2');
  });
  
  it('should handle empty prompts', async () => {
    // Create a mock preprocessor
    const mockPreprocessor: Preprocessor = {
      name: 'mock',
      isEnabled: () => true,
      process: async (prompt) => `${prompt}-processed`
    };
    
    // Register the preprocessor
    preprocessorService.registerPreprocessor(mockPreprocessor);
    
    // Process an empty prompt
    const result = await preprocessorService.process('');
    
    // Verify the result is an empty string
    expect(result).toBe('');
  });
  
  it('should pass options to preprocessors', async () => {
    // Create a mock preprocessor that uses options
    const mockPreprocessor: Preprocessor = {
      name: 'mock',
      isEnabled: (options?: PreprocessorOptions) => options?.mock?.enabled === true,
      process: async (prompt, options?: PreprocessorOptions) => {
        if (options?.mock?.prefix) {
          return `${options.mock.prefix}${prompt}`;
        }
        return prompt;
      }
    };
    
    // Register the preprocessor
    preprocessorService.registerPreprocessor(mockPreprocessor);
    
    // Process a prompt with options
    const options: PreprocessorOptions = {
      mock: {
        enabled: true,
        prefix: 'PREFIX-'
      }
    };
    
    const result = await preprocessorService.process('test', options);
    
    // Verify the options were used
    expect(result).toBe('PREFIX-test');
  });
});