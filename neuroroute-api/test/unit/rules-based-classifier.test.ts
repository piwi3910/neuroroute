/**
 * Unit tests for the rules-based classifier
 */

import { createRulesBasedClassifier } from '../../src/services/classifier/classifiers/rules-based.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '../../test/jest-setup.js';

describe('Rules-based Classifier', () => {
  const classifier = createRulesBasedClassifier();

  it('should be enabled by default', () => {
    expect(classifier.isEnabled()).toBe(true);
  });

  it('should have the correct name', () => {
    expect(classifier.name).toBe('rules-based');
  });

  it('should classify code prompts correctly', async () => {
    const prompt = 'Write a JavaScript function to calculate the factorial of a number';
    const result = await classifier.classify(prompt);
    
    expect(result.type).toBe('code');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.features).toContain('code-generation');
    expect(result.features).toContain('syntax-highlighting');
  });

  it('should classify creative prompts correctly', async () => {
    const prompt = 'Write a short story about a robot who discovers emotions';
    const result = await classifier.classify(prompt);
    
    expect(result.type).toBe('creative');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should classify analytical prompts correctly', async () => {
    const prompt = 'Analyze the impact of artificial intelligence on the job market';
    const result = await classifier.classify(prompt);
    
    expect(result.type).toBe('analytical');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.features).toContain('reasoning');
  });

  it('should classify factual prompts correctly', async () => {
    const prompt = 'What is the capital of France?';
    const result = await classifier.classify(prompt);
    
    expect(result.type).toBe('factual');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.features).toContain('knowledge-retrieval');
  });

  it('should classify mathematical prompts correctly', async () => {
    const prompt = 'Calculate the derivative of f(x) = x^2 + 3x + 2';
    const result = await classifier.classify(prompt);
    
    expect(result.type).toBe('mathematical');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.features).toContain('equation-solving');
  });

  it('should classify conversational prompts correctly', async () => {
    const prompt = 'Hello, how are you today?';
    const result = await classifier.classify(prompt);
    
    expect(result.type).toBe('conversational');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should determine complexity based on length', async () => {
    const shortPrompt = 'What is 2 + 2?';
    const mediumPrompt = 'Explain the concept of quantum computing in about 100 words. Include the basic principles and potential applications.';
    const longPrompt = 'Write a detailed essay about the history of artificial intelligence, starting from the early concepts in the 1950s to modern deep learning approaches. Include key milestones, important researchers, major breakthroughs, and how each development has contributed to the field. Also discuss the ethical implications and potential future directions.' + 
      'Additionally, analyze how AI has impacted various industries such as healthcare, finance, transportation, and entertainment. Provide specific examples of AI applications in each sector and discuss both the benefits and challenges. Consider the economic implications, including job displacement and creation of new roles.';
    
    const shortResult = await classifier.classify(shortPrompt);
    const mediumResult = await classifier.classify(mediumPrompt);
    const longResult = await classifier.classify(longPrompt);
    
    expect(shortResult.complexity).toBe('simple');
    expect(mediumResult.complexity).toBe('medium');
    expect(longResult.complexity).toBe('very-complex');
  });

  it('should handle options for adjusting confidence', async () => {
    const prompt = 'Write a function to sort an array';
    
    const result1 = await classifier.classify(prompt, { minConfidence: 0.9 });
    expect(result1.confidence).toBeGreaterThanOrEqual(0.9);
    
    const result2 = await classifier.classify(prompt, { maxConfidence: 0.6 });
    expect(result2.confidence).toBeLessThanOrEqual(0.6);
  });

  it('should prioritize features when requested', async () => {
    const prompt = 'What is the capital of France?';
    const priorityFeatures = ['reasoning', 'step-by-step'];
    
    const result = await classifier.classify(prompt, { prioritizeFeatures: priorityFeatures });
    
    expect(result.features).toContain('knowledge-retrieval'); // Original feature
    expect(result.features).toContain('reasoning'); // Prioritized feature
    expect(result.features).toContain('step-by-step'); // Prioritized feature
  });

  it('should handle errors gracefully', async () => {
    // Mock a situation that would cause an error
    const malformedPrompt = null as unknown as string;
    
    // Should not throw but return a default classification
    const result = await classifier.classify(malformedPrompt);
    
    expect(result).toBeDefined();
    expect(result.type).toBe('general');
    expect(result.complexity).toBe('medium');
    expect(result.confidence).toBe(0.5);
  });
});