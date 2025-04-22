import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import createClassifierService, { ClassifierService } from '../../src/services/classifier';

describe('Classifier Service', () => {
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
  });
});