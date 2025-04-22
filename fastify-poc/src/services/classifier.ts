import { FastifyInstance } from 'fastify';

// Intent classification types
export interface ClassifiedIntent {
  type: 'general' | 'code' | 'creative' | 'analytical';
  complexity: 'simple' | 'medium' | 'complex';
  features: string[];
}

// Prompt classifier service
export class ClassifierService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Classify a prompt to determine its intent
   * @param prompt The user prompt
   * @returns The classified intent
   */
  async classifyPrompt(prompt: string): Promise<ClassifiedIntent> {
    try {
      // In a real implementation, this would use a more sophisticated
      // classification algorithm, possibly with machine learning
      
      // For this proof of concept, we'll use a simple rule-based approach
      const promptLower = prompt.toLowerCase();
      
      // Determine type
      let type: ClassifiedIntent['type'] = 'general';
      if (promptLower.includes('code') || 
          promptLower.includes('function') || 
          promptLower.includes('program')) {
        type = 'code';
      } else if (promptLower.includes('story') || 
                promptLower.includes('creative') || 
                promptLower.includes('imagine')) {
        type = 'creative';
      } else if (promptLower.includes('analyze') || 
                promptLower.includes('explain') || 
                promptLower.includes('compare')) {
        type = 'analytical';
      }
      
      // Determine complexity
      let complexity: ClassifiedIntent['complexity'] = 'simple';
      if (prompt.length > 500) {
        complexity = 'complex';
      } else if (prompt.length > 100) {
        complexity = 'medium';
      }
      
      // Determine required features
      const features: string[] = ['text-generation'];
      if (type === 'code') {
        features.push('code-generation');
      }
      if (complexity === 'complex' || type === 'analytical') {
        features.push('reasoning');
      }
      
      const intent: ClassifiedIntent = {
        type,
        complexity,
        features,
      };
      
      this.fastify.log.debug({ intent }, 'Prompt classified');
      return intent;
    } catch (error) {
      this.fastify.log.error(error, 'Classification failed');
      // Return a default classification if something goes wrong
      return {
        type: 'general',
        complexity: 'medium',
        features: ['text-generation'],
      };
    }
  }
}

// Factory function to create a classifier service
export function createClassifierService(fastify: FastifyInstance) {
  return new ClassifierService(fastify);
}

export default createClassifierService;