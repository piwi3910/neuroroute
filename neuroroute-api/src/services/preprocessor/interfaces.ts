/**
 * Preprocessor Service Interfaces
 * 
 * This file defines the interfaces for the preprocessor service and its plugins.
 * The preprocessor service is responsible for handling initial prompt processing
 * before it's passed to the classifier and router.
 */

/**
 * Options that can be passed to preprocessors
 */
export interface PreprocessorOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Error class for preprocessor-specific errors
 */
export class PreprocessorError extends Error {
  /**
   * Create a new preprocessor error
   *
   * @param message - Error message
   * @param preprocessorName - Name of the preprocessor that caused the error
   */
  constructor(message: string, public preprocessorName: string) {
    super(`[${preprocessorName}] ${message}`);
    this.name = 'PreprocessorError';
  }
}

/**
 * Interface for preprocessor plugins
 */
export interface Preprocessor {
  /**
   * Unique name of the preprocessor
   */
  name: string;

  /**
   * Process a prompt string
   * 
   * @param prompt - The prompt to process
   * @param options - Optional configuration for the preprocessor
   * @returns The processed prompt
   */
  process(prompt: string, options?: PreprocessorOptions): Promise<string>;

  /**
   * Check if the preprocessor is enabled
   * 
   * @param options - Optional configuration that may affect enablement
   * @returns Whether the preprocessor is enabled
   */
  isEnabled(options?: PreprocessorOptions): boolean;
}

/**
 * Interface for the preprocessor registry
 */
export interface PreprocessorRegistry {
  /**
   * Register a preprocessor
   * 
   * @param preprocessor - The preprocessor to register
   */
  register(preprocessor: Preprocessor): void;

  /**
   * Get all registered preprocessors
   * 
   * @returns Array of all registered preprocessors
   */
  getAll(): Preprocessor[];

  /**
   * Get a specific preprocessor by name
   * 
   * @param name - The name of the preprocessor to retrieve
   * @returns The preprocessor or undefined if not found
   */
  get(name: string): Preprocessor | undefined;
  /**
   * Process a prompt through all enabled preprocessors
   * 
   * @param prompt - The prompt to process
   * @param options - Optional configuration for the preprocessors
   * @returns The processed prompt
   */
  process(prompt: string, options?: PreprocessorOptions): Promise<string>;
}

/**
 * Interface for the preprocessor service
 */
export interface PreprocessorService {
  /**
   * Register a preprocessor
   * 
   * @param preprocessor - The preprocessor to register
   */
  registerPreprocessor(preprocessor: Preprocessor): void;

  /**
   * Get a specific preprocessor by name
   * 
   * @param name - The name of the preprocessor to retrieve
   * @returns The preprocessor or undefined if not found
   */
  getPreprocessor(name: string): Preprocessor | undefined;

  /**
   * Get all registered preprocessors
   * 
   * @returns Array of all registered preprocessors
   */
  getAllPreprocessors(): Preprocessor[];

  /**
   * Process a prompt through all enabled preprocessors
   * 
   * @param prompt - The prompt to process
   * @param options - Optional configuration for the preprocessors
   * @returns The processed prompt
   */
  process(prompt: string, options?: PreprocessorOptions): Promise<string>;
}