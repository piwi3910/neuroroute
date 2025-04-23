/**
 * ML-based classifier implementation
 * 
 * This classifier uses machine learning techniques to classify prompts based on
 * content patterns, semantic analysis, and historical data.
 */

import { Classifier, ClassifiedIntent, ClassifierOptions } from '../interfaces.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger({ level: 'info', prettyPrint: true });

/**
 * Creates an ML-based classifier
 */
export function createMlBasedClassifier(): Classifier {
  // Flag to determine if the classifier is enabled
  // This is disabled by default as it requires additional setup
  const enabled = false;
  
  // Simulated model weights for different features
  // In a real implementation, these would be loaded from a trained model
  const modelWeights = {
    codeKeywords: 0.8,
    creativeKeywords: 0.7,
    analyticalKeywords: 0.75,
    factualKeywords: 0.65,
    mathematicalKeywords: 0.9,
    conversationalKeywords: 0.85,
    
    // Structural features
    questionMark: 0.6,
    codeBlocks: 0.95,
    bulletPoints: 0.5,
    equations: 0.85,
    
    // Length features
    shortLength: 0.3,
    mediumLength: 0.5,
    longLength: 0.7
  };
  
  /**
   * Extract features from the prompt text
   */
  function extractFeatures(prompt: string): Record<string, number> {
    const lowerPrompt = prompt.toLowerCase();
    const features: Record<string, number> = {};
    
    // Code-related keywords
    const codeKeywords = ['function', 'code', 'program', 'algorithm', 'javascript', 'python', 'class', 'method'];
    features.codeKeywords = codeKeywords.filter(word => lowerPrompt.includes(word)).length / codeKeywords.length;
    
    // Creative keywords
    const creativeKeywords = ['story', 'poem', 'creative', 'novel', 'fiction', 'narrative', 'character'];
    features.creativeKeywords = creativeKeywords.filter(word => lowerPrompt.includes(word)).length / creativeKeywords.length;
    
    // Analytical keywords
    const analyticalKeywords = ['analyze', 'compare', 'evaluate', 'assess', 'implications', 'impact'];
    features.analyticalKeywords = analyticalKeywords.filter(word => lowerPrompt.includes(word)).length / analyticalKeywords.length;
    
    // Factual keywords
    const factualKeywords = ['what is', 'who is', 'when did', 'where is', 'how does', 'explain'];
    features.factualKeywords = factualKeywords.filter(phrase => lowerPrompt.includes(phrase)).length / factualKeywords.length;
    
    // Mathematical keywords
    const mathematicalKeywords = ['calculate', 'solve', 'equation', 'math', 'formula'];
    features.mathematicalKeywords = mathematicalKeywords.filter(word => lowerPrompt.includes(word)).length / mathematicalKeywords.length;
    
    // Conversational keywords
    const conversationalKeywords = ['hello', 'hi there', 'how are you', 'nice to meet', 'good morning'];
    features.conversationalKeywords = conversationalKeywords.filter(phrase => lowerPrompt.includes(phrase)).length / conversationalKeywords.length;
    
    // Structural features
    features.questionMark = prompt.includes('?') ? 1 : 0;
    features.codeBlocks = (prompt.includes('```') || prompt.includes('    ')) ? 1 : 0;
    features.bulletPoints = (prompt.includes('- ') || prompt.includes('* ')) ? 1 : 0;
    features.equations = /\d+\s*[+\-*/]\s*\d+/.test(prompt) ? 1 : 0;
    
    // Length features
    const length = prompt.length;
    features.shortLength = length < 50 ? 1 : 0;
    features.mediumLength = length >= 50 && length < 200 ? 1 : 0;
    features.longLength = length >= 200 ? 1 : 0;
    
    return features;
  }
  
  /**
   * Calculate scores for each type based on extracted features
   */
  function calculateScores(features: Record<string, number>): Record<string, number> {
    const scores: Record<string, number> = {
      code: 0,
      creative: 0,
      analytical: 0,
      factual: 0,
      mathematical: 0,
      conversational: 0,
      general: 0.3 // Base score for general type
    };
    
    // Calculate weighted scores
    for (const [feature, value] of Object.entries(features)) {
      if (feature.includes('code') || feature === 'codeBlocks') {
        scores.code += value * (modelWeights[feature as keyof typeof modelWeights] || 0.5);
      }
      
      if (feature.includes('creative')) {
        scores.creative += value * (modelWeights[feature as keyof typeof modelWeights] || 0.5);
      }
      
      if (feature.includes('analytical') || feature === 'bulletPoints') {
        scores.analytical += value * (modelWeights[feature as keyof typeof modelWeights] || 0.5);
      }
      
      if (feature.includes('factual') || feature === 'questionMark') {
        scores.factual += value * (modelWeights[feature as keyof typeof modelWeights] || 0.5);
      }
      
      if (feature.includes('mathematical') || feature === 'equations') {
        scores.mathematical += value * (modelWeights[feature as keyof typeof modelWeights] || 0.5);
      }
      
      if (feature.includes('conversational')) {
        scores.conversational += value * (modelWeights[feature as keyof typeof modelWeights] || 0.5);
      }
    }
    
    // Normalize scores to be between 0 and 1
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const type in scores) {
        scores[type] = scores[type] / maxScore;
      }
    }
    
    return scores;
  }
  
  /**
   * Determine the complexity of the prompt
   */
  function determineComplexity(prompt: string): ClassifiedIntent['complexity'] {
    const length = prompt.length;
    const sentenceCount = prompt.split(/[.!?]+/).length - 1;
    const wordCount = prompt.split(/\s+/).length;
    
    // Calculate complexity based on multiple factors
    let complexityScore = 0;
    
    // Length factor
    if (length < 50) complexityScore += 0.2;
    else if (length < 200) complexityScore += 0.5;
    else if (length < 500) complexityScore += 0.8;
    else complexityScore += 1.0;
    
    // Sentence count factor
    if (sentenceCount < 3) complexityScore += 0.2;
    else if (sentenceCount < 8) complexityScore += 0.5;
    else if (sentenceCount < 15) complexityScore += 0.8;
    else complexityScore += 1.0;
    
    // Word count factor
    if (wordCount < 10) complexityScore += 0.2;
    else if (wordCount < 40) complexityScore += 0.5;
    else if (wordCount < 100) complexityScore += 0.8;
    else complexityScore += 1.0;
    
    // Determine complexity category based on average score
    const avgScore = complexityScore / 3;
    
    if (avgScore < 0.3) return 'simple';
    if (avgScore < 0.6) return 'medium';
    if (avgScore < 0.9) return 'complex';
    return 'very-complex';
  }
  
  /**
   * Identify features needed for the prompt
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
        
        if (lowerPrompt.includes('explain') || lowerPrompt.includes('comment')) {
          features.push('code-explanation');
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
        
        if (lowerPrompt.includes('setting') || lowerPrompt.includes('world')) {
          features.push('world-building');
        }
        break;
        
      case 'analytical':
        features.push('reasoning');
        features.push('critical-thinking');
        
        if (lowerPrompt.includes('data') || lowerPrompt.includes('statistics')) {
          features.push('data-analysis');
        }
        
        if (lowerPrompt.includes('pros') && lowerPrompt.includes('cons')) {
          features.push('pros-cons-analysis');
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
        
        if (lowerPrompt.includes('latest') || lowerPrompt.includes('recent')) {
          features.push('up-to-date-information');
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
        
        if (lowerPrompt.includes('step')) {
          features.push('step-by-step-solution');
        }
        break;
        
      case 'conversational':
        features.push('conversational-tone');
        features.push('natural-language');
        
        if (lowerPrompt.includes('help') || lowerPrompt.includes('assist')) {
          features.push('helpful-response');
        }
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
    if ((type === 'code' || type === 'mathematical') && 
        (complexity === 'complex' || complexity === 'very-complex')) {
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
    // More sophisticated token estimation based on prompt characteristics
    const promptTokens = Math.ceil(prompt.length / 3.5); // Approximate tokens per character
    
    // Base multiplier by type
    let completionMultiplier = 1;
    
    switch (type) {
      case 'code':
        completionMultiplier = 2.8;
        break;
      case 'creative':
        completionMultiplier = 3.2;
        break;
      case 'analytical':
        completionMultiplier = 2.5;
        break;
      case 'factual':
        completionMultiplier = 2.0;
        break;
      case 'mathematical':
        completionMultiplier = 1.8;
        break;
      case 'conversational':
        completionMultiplier = 1.5;
        break;
      default:
        completionMultiplier = 1.8;
    }
    
    // Adjust based on complexity
    switch (complexity) {
      case 'simple':
        completionMultiplier *= 0.7;
        break;
      case 'medium':
        // No adjustment
        break;
      case 'complex':
        completionMultiplier *= 1.8;
        break;
      case 'very-complex':
        completionMultiplier *= 3.0;
        break;
    }
    
    // Additional adjustments based on prompt characteristics
    if (prompt.includes('step by step')) {
      completionMultiplier *= 1.3; // Step-by-step explanations tend to be longer
    }
    
    if (prompt.includes('detailed')) {
      completionMultiplier *= 1.2; // Requests for detailed responses
    }
    
    if (prompt.includes('brief') || prompt.includes('concise')) {
      completionMultiplier *= 0.8; // Requests for brief responses
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
    name: 'ml-based',
    
    isEnabled(): boolean {
      return enabled;
    },
    
    async classify(prompt: string, options?: ClassifierOptions): Promise<ClassifiedIntent> {
      try {
        // Handle null or undefined prompt
        if (!prompt) {
          logger.warn('ML classifier received empty prompt');
          return {
            type: 'general',
            complexity: 'medium',
            features: ['general-purpose'],
            priority: 'medium',
            confidence: 0.5,
            tokens: { estimated: 0, completion: 0 }
          };
        }
        
        // Extract features from the prompt
        const features = extractFeatures(prompt);
        
        // Calculate scores for each type
        const scores = calculateScores(features);
        
        // Determine the most likely type
        let maxScore = 0;
        let maxType: ClassifiedIntent['type'] = 'general';
        
        for (const [type, score] of Object.entries(scores)) {
          if (score > maxScore) {
            maxScore = score;
            maxType = type;
          }
        }
        
        // Determine other characteristics
        const complexity = determineComplexity(prompt);
        const featureList = identifyFeatures(prompt, maxType);
        const priority = determinePriority(maxType, complexity);
        const tokens = estimateTokens(prompt, maxType, complexity);
        
        // Adjust confidence based on options
        const confidence = adjustConfidence(maxScore, options);
        
        // Add priority features if requested
        const priorityFeatures = addPriorityFeatures(featureList, options);
        
        logger.debug(`ML classifier result: ${maxType} (${confidence.toFixed(2)})`);
        
        return {
          type: maxType,
          complexity,
          features: priorityFeatures,
          priority,
          confidence,
          tokens
        };
      } catch {
        // Fallback to a default classification in case of errors
        logger.error('Error in ML classifier, returning default classification');
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