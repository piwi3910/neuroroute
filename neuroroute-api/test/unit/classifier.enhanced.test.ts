import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import createClassifierService, { ClassifierService, ClassifiedIntent } from '../../src/services/classifier.js';

describe('Classifier Service Enhanced Tests', () => {
  let app: FastifyInstance;
  let classifierService: ClassifierService;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Create classifier service
    classifierService = createClassifierService(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('classifyPrompt', () => {
    it('should classify a general prompt correctly', async () => {
      const prompt = 'Tell me about the weather today';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'general');
      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('features');
      expect(result.features).toContain('text-generation');
    });

    it('should classify a code prompt correctly', async () => {
      const prompt = 'Write a function to calculate fibonacci numbers in JavaScript code';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'code');
      expect(result.features).toContain('code-generation');
    });

    it('should classify a creative prompt correctly', async () => {
      const prompt = 'Write a creative story about a dragon and a knight';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'creative');
    });

    it('should classify an analytical prompt correctly', async () => {
      const prompt = 'Analyze the impact of climate change on global economies';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'analytical');
      expect(result.features).toContain('reasoning');
    });

    it('should classify a factual prompt correctly', async () => {
      const prompt = 'What is the capital of France?';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'factual');
      expect(result.features).toContain('knowledge-retrieval');
    });

    it('should classify a mathematical prompt correctly', async () => {
      const prompt = 'Calculate the derivative of f(x) = x^2 + 3x + 2';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'mathematical');
      expect(result.features).toContain('equation-solving');
    });

    it('should classify a conversational prompt correctly', async () => {
      const prompt = 'Hello, how are you today?';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result).toHaveProperty('type', 'conversational');
      expect(result).toHaveProperty('priority', 'low');
    });

    it('should determine complexity based on prompt length', async () => {
      // Short prompt
      const shortPrompt = 'Hello world';
      const shortResult = await classifierService.classifyPrompt(shortPrompt);
      expect(shortResult).toHaveProperty('complexity', 'simple');
      
      // Medium prompt
      const mediumPrompt = 'A'.repeat(150);
      const mediumResult = await classifierService.classifyPrompt(mediumPrompt);
      expect(mediumResult).toHaveProperty('complexity', 'medium');
      
      // Complex prompt
      const complexPrompt = 'A'.repeat(600);
      const complexResult = await classifierService.classifyPrompt(complexPrompt);
      expect(complexResult).toHaveProperty('complexity', 'complex');
      
      // Very complex prompt
      const veryComplexPrompt = 'A'.repeat(1000);
      const veryComplexResult = await classifierService.classifyPrompt(veryComplexPrompt);
      expect(veryComplexResult).toHaveProperty('complexity', 'very-complex');
    });

    it('should adjust complexity based on sentence structure', async () => {
      // Short sentences
      const shortSentencesPrompt = 'This is a test. It has short sentences. Many of them.';
      const shortSentencesResult = await classifierService.classifyPrompt(shortSentencesPrompt);
      
      // Long sentences
      const longSentencesPrompt = 'This is a test with a very long sentence that contains many words and should be classified as having complex sentence structure because the average words per sentence is quite high and should trigger the complexity adjustment in the classifier service implementation.';
      const longSentencesResult = await classifierService.classifyPrompt(longSentencesPrompt);
      
      // The long sentence prompt should be classified as more complex
      expect(getComplexityLevel(longSentencesResult.complexity)).toBeGreaterThan(
        getComplexityLevel(shortSentencesResult.complexity)
      );
    });

    it('should detect step-by-step feature correctly', async () => {
      const prompt = 'Explain how to bake a cake step by step';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result.features).toContain('step-by-step');
    });

    it('should detect summarization feature correctly', async () => {
      const prompt = 'Summarize the key points of the climate change report';
      const result = await classifierService.classifyPrompt(prompt);
      
      expect(result.features).toContain('summarization');
    });

    it('should estimate token count based on text length', async () => {
      const prompt = 'This is a test prompt with approximately 10 tokens.';
      const result = await classifierService.classifyPrompt(prompt);
      
      // Simple approximation: 1 token ≈ 4 characters
      const expectedTokens = Math.ceil(prompt.length / 4);
      expect(result.tokens.estimated).toBe(expectedTokens);
    });

    it('should estimate completion tokens based on prompt type', async () => {
      // Code prompts should generate more tokens
      const codePrompt = 'Write a JavaScript function to sort an array';
      const codeResult = await classifierService.classifyPrompt(codePrompt);
      
      // Creative prompts should generate even more tokens
      const creativePrompt = 'Write a short story about a space explorer';
      const creativeResult = await classifierService.classifyPrompt(creativePrompt);
      
      // Simple prompts should generate fewer tokens
      const simplePrompt = 'What time is it?';
      const simpleResult = await classifierService.classifyPrompt(simplePrompt);
      
      // Check relative token estimates
      expect(creativeResult.tokens.completion).toBeGreaterThan(codeResult.tokens.completion);
      expect(codeResult.tokens.completion).toBeGreaterThan(simpleResult.tokens.completion);
    });

    it('should detect language correctly', async () => {
      // English
      const englishPrompt = 'This is an English prompt';
      const englishResult = await classifierService.classifyPrompt(englishPrompt);
      expect(englishResult.language).toBe('english');
      
      // Spanish
      const spanishPrompt = 'Hola, ¿cómo estás?';
      const spanishResult = await classifierService.classifyPrompt(spanishPrompt);
      expect(spanishResult.language).toBe('spanish');
      
      // French
      const frenchPrompt = 'Bonjour, comment ça va?';
      const frenchResult = await classifierService.classifyPrompt(frenchPrompt);
      expect(frenchResult.language).toBe('french');
      
      // German
      const germanPrompt = 'Hallo, wie geht es dir?';
      const germanResult = await classifierService.classifyPrompt(germanPrompt);
      expect(germanResult.language).toBe('german');
    });

    it('should detect domain correctly', async () => {
      // Web development
      const webDevPrompt = 'How do I create a React component with TypeScript?';
      const webDevResult = await classifierService.classifyPrompt(webDevPrompt);
      expect(webDevResult.domain).toBe('web-development');
      
      // Machine learning
      const mlPrompt = 'Explain how neural networks work in machine learning';
      const mlResult = await classifierService.classifyPrompt(mlPrompt);
      expect(mlResult.domain).toBe('machine-learning');
      
      // Database
      const dbPrompt = 'Write a SQL query to join two tables in a database';
      const dbResult = await classifierService.classifyPrompt(dbPrompt);
      expect(dbResult.domain).toBe('database');
    });

    it('should handle errors gracefully', async () => {
      // Mock implementation to force an error
      jest.spyOn(classifierService as any, 'classifyPrompt').mockImplementationOnce(() => {
        throw new Error('Classification failed');
      });
      
      // Should return default classification on error
      const result = await classifierService.classifyPrompt('Test prompt');
      
      expect(result).toHaveProperty('type', 'general');
      expect(result).toHaveProperty('complexity', 'medium');
      expect(result.features).toContain('text-generation');
    });

    it('should handle empty prompts gracefully', async () => {
      const result = await classifierService.classifyPrompt('');
      
      expect(result).toHaveProperty('type', 'general');
      expect(result).toHaveProperty('complexity', 'simple');
      expect(result.features).toContain('text-generation');
    });

    it('should handle very long prompts gracefully', async () => {
      // Create a very long prompt (10,000 characters)
      const longPrompt = 'A'.repeat(10000);
      const result = await classifierService.classifyPrompt(longPrompt);
      
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('complexity', 'very-complex');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens.estimated).toBeGreaterThan(2000); // At least 2000 tokens
    });

    it('should handle context parameter correctly', async () => {
      const prompt = 'Continue the story';
      const context = { 
        previousPrompts: ['Once upon a time'],
        domain: 'creative-writing'
      };
      
      const result = await classifierService.classifyPrompt(prompt, context);
      
      // With context, this should be classified as creative
      expect(result).toHaveProperty('type');
      expect(result.features).toContain('text-generation');
    });
  });
});

// Helper function to convert complexity string to numeric level
function getComplexityLevel(complexity: string): number {
  switch (complexity) {
    case 'simple': return 1;
    case 'medium': return 2;
    case 'complex': return 3;
    case 'very-complex': return 4;
    default: return 0;
  }
}