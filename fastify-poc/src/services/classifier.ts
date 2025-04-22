import { FastifyInstance } from 'fastify';

// Intent classification types
export interface ClassifiedIntent {
  type: 'general' | 'code' | 'creative' | 'analytical' | 'factual' | 'mathematical' | 'conversational';
  complexity: 'simple' | 'medium' | 'complex' | 'very-complex';
  features: string[];
  priority: 'low' | 'medium' | 'high';
  confidence: number;
  tokens: {
    estimated: number;
    completion: number;
  };
  domain?: string;
  language?: string;
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
  /**
   * Classify a prompt to determine its intent
   * @param prompt The user prompt
   * @param context Optional context for classification
   * @returns The classified intent
   */
  async classifyPrompt(prompt: string, context?: Record<string, any>): Promise<ClassifiedIntent> {
    try {
      // In a real implementation, this would use a more sophisticated
      // classification algorithm, possibly with machine learning
      
      // For this proof of concept, we'll use a rule-based approach
      const promptLower = prompt.toLowerCase();
      
      // Determine type with more categories
      let type: ClassifiedIntent['type'] = 'general';
      let confidence = 0.7; // Default confidence
      
      // Code detection
      if (promptLower.includes('code') ||
          promptLower.includes('function') ||
          promptLower.includes('program') ||
          promptLower.includes('algorithm') ||
          /\bclass\b/.test(promptLower) ||
          /\bfunction\b/.test(promptLower) ||
          /\bvar\b/.test(promptLower) ||
          /\bconst\b/.test(promptLower) ||
          /\blet\b/.test(promptLower) ||
          promptLower.includes('javascript') ||
          promptLower.includes('python') ||
          promptLower.includes('typescript')) {
        type = 'code';
        confidence = 0.85;
      }
      // Creative detection
      else if (promptLower.includes('story') ||
               promptLower.includes('creative') ||
               promptLower.includes('imagine') ||
               promptLower.includes('write a') ||
               promptLower.includes('generate a') ||
               promptLower.includes('poem') ||
               promptLower.includes('fiction') ||
               promptLower.includes('narrative')) {
        type = 'creative';
        confidence = 0.8;
      }
      // Analytical detection
      else if (promptLower.includes('analyze') ||
               promptLower.includes('explain') ||
               promptLower.includes('compare') ||
               promptLower.includes('evaluate') ||
               promptLower.includes('assess') ||
               promptLower.includes('review') ||
               promptLower.includes('critique')) {
        type = 'analytical';
        confidence = 0.85;
      }
      // Factual detection
      else if (promptLower.includes('what is') ||
               promptLower.includes('who is') ||
               promptLower.includes('when did') ||
               promptLower.includes('where is') ||
               promptLower.includes('how does') ||
               promptLower.includes('fact') ||
               promptLower.includes('information about')) {
        type = 'factual';
        confidence = 0.8;
      }
      // Mathematical detection
      else if (promptLower.includes('calculate') ||
               promptLower.includes('compute') ||
               promptLower.includes('solve') ||
               promptLower.includes('equation') ||
               promptLower.includes('math') ||
               /\d+\s*[\+\-\*\/]\s*\d+/.test(promptLower)) {
        type = 'mathematical';
        confidence = 0.9;
      }
      // Conversational detection
      else if (promptLower.includes('hello') ||
               promptLower.includes('hi there') ||
               promptLower.includes('how are you') ||
               promptLower.includes('nice to meet') ||
               promptLower.includes('thanks') ||
               promptLower.includes('thank you')) {
        type = 'conversational';
        confidence = 0.75;
      }
      
      // Determine complexity with more granularity
      let complexity: ClassifiedIntent['complexity'] = 'simple';
      
      // Word count is a better measure than character count
      const wordCount = prompt.split(/\s+/).length;
      
      if (wordCount > 300) {
        complexity = 'very-complex';
      } else if (wordCount > 150) {
        complexity = 'complex';
      } else if (wordCount > 50) {
        complexity = 'medium';
      }
      
      // Adjust complexity based on sentence structure
      const sentences = prompt.split(/[.!?]+/).length;
      const avgWordsPerSentence = wordCount / Math.max(1, sentences);
      
      if (avgWordsPerSentence > 25) {
        // Bump up complexity for complex sentence structure
        complexity = complexity === 'very-complex' ? 'very-complex' :
                    complexity === 'complex' ? 'very-complex' :
                    complexity === 'medium' ? 'complex' : 'medium';
      }
      
      // Determine required features with more options
      const features: string[] = ['text-generation'];
      
      if (type === 'code') {
        features.push('code-generation');
        features.push('syntax-highlighting');
      }
      
      if (type === 'mathematical') {
        features.push('equation-solving');
      }
      
      if (complexity === 'complex' || complexity === 'very-complex' || type === 'analytical') {
        features.push('reasoning');
      }
      
      if (type === 'factual') {
        features.push('knowledge-retrieval');
      }
      
      if (promptLower.includes('step by step') ||
          promptLower.includes('explain how') ||
          promptLower.includes('tutorial')) {
        features.push('step-by-step');
      }
      
      if (promptLower.includes('summarize') ||
          promptLower.includes('summary') ||
          promptLower.includes('tldr')) {
        features.push('summarization');
      }
      
      // Determine priority based on type and complexity
      let priority: ClassifiedIntent['priority'] = 'medium';
      
      if (type === 'code' || type === 'analytical' || complexity === 'very-complex') {
        priority = 'high';
      } else if (type === 'conversational' || complexity === 'simple') {
        priority = 'low';
      }
      
      // Estimate token count
      // Rough estimate: 1 token ≈ 4 characters for English text
      const estimatedTokens = Math.ceil(prompt.length / 4);
      
      // Estimate completion tokens based on prompt type and complexity
      let completionTokens = estimatedTokens;
      if (type === 'code') {
        completionTokens = estimatedTokens * 2; // Code often generates more output
      } else if (type === 'creative') {
        completionTokens = estimatedTokens * 3; // Creative tasks generate more content
      } else if (complexity === 'simple') {
        completionTokens = Math.min(estimatedTokens, 100); // Simple queries get shorter responses
      }
      
      // Detect language (simple detection)
      let language: string | undefined;
      
      if (/[а-яА-Я]/.test(prompt)) {
        language = 'russian';
      } else if (/[ñáéíóúÁÉÍÓÚ]/.test(prompt)) {
        language = 'spanish';
      } else if (/[àâçéèêëîïôùûüÿÀÂÇÉÈÊËÎÏÔÙÛÜŸ]/.test(prompt)) {
        language = 'french';
      } else if (/[äöüßÄÖÜ]/.test(prompt)) {
        language = 'german';
      } else if (/[\u4e00-\u9fa5]/.test(prompt)) {
        language = 'chinese';
      } else if (/[\u3040-\u30ff]/.test(prompt)) {
        language = 'japanese';
      } else if (/[\uac00-\ud7af]/.test(prompt)) {
        language = 'korean';
      } else {
        language = 'english'; // Default
      }
      
      // Detect domain (simple detection)
      let domain: string | undefined;
      
      if (promptLower.includes('javascript') ||
          promptLower.includes('typescript') ||
          promptLower.includes('react') ||
          promptLower.includes('node')) {
        domain = 'web-development';
      } else if (promptLower.includes('machine learning') ||
                promptLower.includes('neural network') ||
                promptLower.includes('ai') ||
                promptLower.includes('data science')) {
        domain = 'machine-learning';
      } else if (promptLower.includes('database') ||
                promptLower.includes('sql') ||
                promptLower.includes('query') ||
                promptLower.includes('postgres')) {
        domain = 'database';
      }
      
      const intent: ClassifiedIntent = {
        type,
        complexity,
        features,
        priority,
        confidence,
        tokens: {
          estimated: estimatedTokens,
          completion: completionTokens
        },
        domain,
        language
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
        priority: 'medium',
        confidence: 0.5,
        tokens: {
          estimated: Math.ceil(prompt.length / 4),
          completion: Math.ceil(prompt.length / 4)
        }
      };
    }
  }
}

// Factory function to create a classifier service
export function createClassifierService(fastify: FastifyInstance) {
  return new ClassifierService(fastify);
}

export default createClassifierService;