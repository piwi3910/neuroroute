/**
 * Interfaces for the classifier service
 */

/**
 * Classification result
 */
export interface ClassifiedIntent {
  /**
   * The type of intent (e.g., 'general', 'code', 'creative', etc.)
   */
  type: string;
  
  /**
   * The complexity of the intent (e.g., 'simple', 'medium', 'complex', 'very-complex')
   */
  complexity: 'simple' | 'medium' | 'complex' | 'very-complex';
  
  /**
   * Features required for this intent (e.g., 'code-generation', 'creative-writing', etc.)
   */
  features: string[];
  
  /**
   * The priority of the intent (e.g., 'low', 'medium', 'high')
   */
  priority: 'low' | 'medium' | 'high';
  
  /**
   * The confidence of the classification (0-1)
   */
  confidence: number;
  
  /**
   * Token estimates for the intent
   */
  tokens: {
    /**
     * Estimated input tokens
     */
    estimated: number;
    
    /**
     * Estimated completion tokens
     */
    completion: number;
  };
  
  /**
   * Optional domain of the intent (e.g., 'science', 'technology', 'business', etc.)
   */
  domain?: string;
  
  /**
   * Optional language of the intent (e.g., 'javascript', 'python', 'java', etc.)
   */
  language?: string;
}

/**
 * Options for classification
 */
export interface ClassifierOptions {
  /**
   * Whether to include detailed analysis in the result
   */
  detailed?: boolean;
  
  /**
   * Maximum confidence threshold (0-1)
   */
  maxConfidence?: number;
  
  /**
   * Minimum confidence threshold (0-1)
   */
  minConfidence?: number;
  
  /**
   * Features to prioritize
   */
  prioritizeFeatures?: string[];
}

/**
 * Classifier interface
 */
export interface Classifier {
  /**
   * The name of the classifier
   */
  name: string;
  
  /**
   * Check if the classifier is enabled
   */
  isEnabled: () => boolean;
  
  /**
   * Classify a prompt
   * 
   * @param prompt The prompt to classify
   * @param options Optional options for classification
   * @returns The classified intent
   */
  classify: (prompt: string, options?: ClassifierOptions) => Promise<ClassifiedIntent>;
}

/**
 * Classifier registry interface
 */
export interface ClassifierRegistry {
  /**
   * Register a classifier
   * 
   * @param classifier The classifier to register
   */
  register: (classifier: Classifier) => void;
  
  /**
   * Unregister a classifier
   * 
   * @param name The name of the classifier to unregister
   */
  unregister: (name: string) => void;
  
  /**
   * Get a classifier by name
   * 
   * @param name The name of the classifier to get
   * @returns The classifier or undefined if not found
   */
  get: (name: string) => Classifier | undefined;
  
  /**
   * Get all registered classifiers
   * 
   * @returns All registered classifiers
   */
  getAll: () => Classifier[];
  
  /**
   * Get all enabled classifiers
   * 
   * @returns All enabled classifiers
   */
  getEnabled: () => Classifier[];
  
  /**
   * Set the default classifier
   * 
   * @param name The name of the classifier to set as default
   */
  setDefault: (name: string) => void;
  
  /**
   * Get the default classifier
   * 
   * @returns The default classifier
   */
  getDefault: () => Classifier;
  /**
   * Classify a prompt using the registered classifiers
   * 
   * @param prompt The user prompt
   * @param options Optional options for classification
   * @returns The classified intent
   */
  classify: (prompt: string, options?: ClassifierOptions) => Promise<ClassifiedIntent>;

}

/**
 * Classifier service interface
 */
export interface ClassifierService {
  /**
   * The classifier registry
   */
  registry: ClassifierRegistry;
  
  /**
   * Classify a prompt
   * 
   * @param prompt The prompt to classify
   * @param options Optional options for classification
   * @returns The classified intent
   */
  classifyPrompt: (prompt: string, options?: ClassifierOptions) => Promise<ClassifiedIntent>;
}