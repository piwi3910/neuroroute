/**
 * Rules-based classifier implementation
 * 
 * This classifier uses a set of predefined rules to classify prompts based on
 * content patterns, keywords, and structural characteristics.
 */

import { Classifier, ClassifiedIntent, ClassifierOptions } from '../interfaces.js';

/**
 * Creates a rules-based classifier
 */
export function createRulesBasedClassifier(): Classifier {
  // Flag to determine if the classifier is enabled
  const enabled = true;

  /**
   * Analyzes prompt length to determine complexity
   */
  function determineComplexity(prompt: string): ClassifiedIntent['complexity'] {
    const length = prompt.length;
    
    if (length < 50) return 'simple';
    if (length < 200) return 'medium';
    if (length < 500) return 'complex';
    return 'very-complex';
  }

  /**
   * Detects the primary type of the prompt based on content patterns
   */
  function detectType(prompt: string): { type: ClassifiedIntent['type']; confidence: number } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Code-related patterns
    if (
      lowerPrompt.includes('function') ||
      lowerPrompt.includes('code') ||
      lowerPrompt.includes('program') ||
      lowerPrompt.includes('algorithm') ||
      lowerPrompt.includes('javascript') ||
      lowerPrompt.includes('python') ||
      /write a \w+ (function|class|method)/.test(lowerPrompt)
    ) {
      return { type: 'code', confidence: 0.85 };
    }
    
    // Creative writing patterns
    if (
      lowerPrompt.includes('story') ||
      lowerPrompt.includes('poem') ||
      lowerPrompt.includes('creative') ||
      lowerPrompt.includes('write a novel') ||
      lowerPrompt.includes('fiction') ||
      lowerPrompt.includes('narrative')
    ) {
      return { type: 'creative', confidence: 0.8 };
    }
    
    // Analytical patterns
    if (
      lowerPrompt.includes('analyze') ||
      lowerPrompt.includes('compare') ||
      lowerPrompt.includes('evaluate') ||
      lowerPrompt.includes('assess') ||
      lowerPrompt.includes('implications') ||
      lowerPrompt.includes('impact of')
    ) {
      return { type: 'analytical', confidence: 0.75 };
    }
    
    // Factual/knowledge patterns
    if (
      lowerPrompt.includes('what is') ||
      lowerPrompt.includes('who is') ||
      lowerPrompt.includes('when did') ||
      lowerPrompt.includes('where is') ||
      lowerPrompt.includes('how does') ||
      lowerPrompt.includes('explain')
    ) {
      return { type: 'factual', confidence: 0.8 };
    }
    
    // Mathematical patterns
    if (
      lowerPrompt.includes('calculate') ||
      lowerPrompt.includes('solve') ||
      lowerPrompt.includes('equation') ||
      lowerPrompt.includes('math') ||
      lowerPrompt.includes('formula') ||
      /\d+\s*[+\-*/]\s*\d+/.test(lowerPrompt)
    ) {
      return { type: 'mathematical', confidence: 0.85 };
    }
    
    // Conversational patterns
    if (
      lowerPrompt.includes('hello') ||
      lowerPrompt.includes('hi there') ||
      lowerPrompt.includes('how are you') ||
      lowerPrompt.includes('nice to meet') ||
      lowerPrompt.includes('good morning') ||
      lowerPrompt.includes('good afternoon')
    ) {
      return { type: 'conversational', confidence: 0.9 };
    }
    
    // Default to general with lower confidence
    return { type: 'general', confidence: 0.5 };
  }

  /**
   * Identifies features needed for the prompt
   */
  function identifyFeatures(prompt: string, type: ClassifiedIntent['type']): string[] {
    const features: string[] = [];
    const lowerPrompt = prompt.toLowerCase();
    
    // Common features across types
    if (lowerPrompt.includes('step by step') || lowerPrompt.includes('explain how')) {
      features.push('step-by-step');
    }
    
    if (lowerPrompt.includes('example') || lowerPrompt.includes('sample')) {
      features.push('examples');
    }
    
    if (lowerPrompt.includes('compare') || lowerPrompt.includes('contrast') || lowerPrompt.includes('versus')) {
      features.push('comparison');
    }
    
    // Type-specific features
    switch (type) {
      case 'code':
        features.push('code-generation');
        features.push('syntax-highlighting');
        
        if (lowerPrompt.includes('optimize') || lowerPrompt.includes('efficient')) {
          features.push('optimization');
        }
        
        if (lowerPrompt.includes('test') || lowerPrompt.includes('unit test')) {
          features.push('testing');
        }
        break;
        
      case 'creative':
        features.push('creative-writing');
        
        if (lowerPrompt.includes('character') || lowerPrompt.includes('protagonist')) {
          features.push('character-development');
        }
        
        if (lowerPrompt.includes('dialogue') || lowerPrompt.includes('conversation between')) {
          features.push('dialogue');
        }
        break;
        
      case 'analytical':
        features.push('reasoning');
        features.push('critical-thinking');
        
        if (lowerPrompt.includes('data') || lowerPrompt.includes('statistics')) {
          features.push('data-analysis');
        }
        break;
        
      case 'factual':
        features.push('knowledge-retrieval');
        
        if (lowerPrompt.includes('history') || lowerPrompt.includes('historical')) {
          features.push('historical-context');
        }
        
        if (lowerPrompt.includes('science') || lowerPrompt.includes('scientific')) {
          features.push('scientific-accuracy');
        }
        break;
        
      case 'mathematical':
        features.push('equation-solving');
        
        if (lowerPrompt.includes('graph') || lowerPrompt.includes('plot')) {
          features.push('visualization');
        }
        
        if (lowerPrompt.includes('proof') || lowerPrompt.includes('prove')) {
          features.push('mathematical-proof');
        }
        break;
        
      case 'conversational':
        features.push('conversational-tone');
        features.push('natural-language');
        break;
        
      default:
        features.push('general-purpose');
    }
    
    return features;
  }

  /**
   * Determines the priority of the prompt
   */
  function determinePriority(type: ClassifiedIntent['type'], complexity: ClassifiedIntent['complexity']): ClassifiedIntent['priority'] {
    // Code and mathematical prompts generally get higher priority
    if ((type === 'code' || type === 'mathematical') && complexity === 'complex') {
      return 'high';
    }
    
    // Complex analytical prompts also get higher priority
    if (type === 'analytical' && (complexity === 'complex' || complexity === 'very-complex')) {
      return 'high';
    }
    
    // Simple conversational prompts get lower priority
    if (type === 'conversational' && complexity === 'simple') {
      return 'low';
    }
    
    // Default to medium priority
    return 'medium';
  }

  /**
   * Estimates token usage for the prompt and completion
   */
  function estimateTokens(prompt: string, type: ClassifiedIntent['type'], complexity: ClassifiedIntent['complexity']): ClassifiedIntent['tokens'] {
    // Very rough estimation based on prompt length
    const promptTokens = Math.ceil(prompt.length / 4);
    
    // Estimate completion tokens based on type and complexity
    let completionMultiplier = 1;
    
    switch (type) {
      case 'code':
        completionMultiplier = 2.5;
        break;
      case 'creative':
        completionMultiplier = 3;
        break;
      case 'analytical':
        completionMultiplier = 2.2;
        break;
      case 'factual':
        completionMultiplier = 1.8;
        break;
      case 'mathematical':
        completionMultiplier = 1.5;
        break;
      case 'conversational':
        completionMultiplier = 1.2;
        break;
      default:
        completionMultiplier = 1.5;
    }
    
    // Adjust based on complexity
    switch (complexity) {
      case 'simple':
        completionMultiplier *= 0.8;
        break;
      case 'medium':
        // No adjustment
        break;
      case 'complex':
        completionMultiplier *= 1.5;
        break;
      case 'very-complex':
        completionMultiplier *= 2.5;
        break;
    }
    
    const completionTokens = Math.ceil(promptTokens * completionMultiplier);
    
    return {
      estimated: promptTokens,
      completion: completionTokens
    };
  }

  /**
   * Adjusts confidence based on options
   */
  function adjustConfidence(confidence: number, options?: ClassifierOptions): number {
    if (!options) return confidence;
    
    if (options.minConfidence && confidence < options.minConfidence) {
      return options.minConfidence;
    }
    
    if (options.maxConfidence && confidence > options.maxConfidence) {
      return options.maxConfidence;
    }
    
    return confidence;
  }

  /**
   * Adds priority features if requested in options
   */
  function addPriorityFeatures(features: string[], options?: ClassifierOptions): string[] {
    if (!options?.prioritizeFeatures || !Array.isArray(options.prioritizeFeatures)) {
      return features;
    }
    
    // Add any missing priority features
    for (const feature of options.prioritizeFeatures) {
      if (!features.includes(feature)) {
        features.push(feature);
      }
    }
    
    return features;
  }

  return {
    name: 'rules-based',
    
    isEnabled(): boolean {
      return enabled;
    },
    
    async classify(prompt: string, options?: ClassifierOptions): Promise<ClassifiedIntent> {
      try {
        // Handle null or undefined prompt
        if (!prompt) {
          return {
            type: 'general',
            complexity: 'medium',
            features: ['general-purpose'],
            priority: 'medium',
            confidence: 0.5,
            tokens: { estimated: 0, completion: 0 }
          };
        }
        
        // Determine basic characteristics
        const complexity = determineComplexity(prompt);
        const { type, confidence } = detectType(prompt);
        const adjustedConfidence = adjustConfidence(confidence, options);
        const features = identifyFeatures(prompt, type);
        const priorityFeatures = addPriorityFeatures(features, options);
        const priority = determinePriority(type, complexity);
        const tokens = estimateTokens(prompt, type, complexity);
        
        return {
          type,
          complexity,
          features: priorityFeatures,
          priority,
          confidence: adjustedConfidence,
          tokens
        };
      } catch {
        // Fallback to a default classification in case of errors
        return {
          type: 'general',
          complexity: 'medium',
          features: ['general-purpose'],
          priority: 'medium',
          confidence: 0.5,
          tokens: { estimated: 10, completion: 20 }
        };
      }
    }
  };
}
