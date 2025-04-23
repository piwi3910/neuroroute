/**
 * Sanitization Preprocessor
 * 
 * This preprocessor sanitizes prompts by removing potentially harmful content.
 */

import { createLogger } from '../../../utils/logger.js';
import { Preprocessor, PreprocessorOptions, PreprocessorError } from '../interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a sanitization preprocessor
 * 
 * @returns A sanitization preprocessor
 */
export function createSanitizationPreprocessor(): Preprocessor {
  logger.debug('Creating sanitization preprocessor');
  
  return {
    name: 'sanitization',
    
    /**
     * Check if the preprocessor is enabled
     * 
     * @param options Options for the preprocessor
     * @returns True if the preprocessor is enabled, false otherwise
     */
    isEnabled(options?: PreprocessorOptions): boolean {
      // If no sanitization options are provided or enabled is not explicitly set to false, default to enabled
      return options?.sanitization?.enabled !== false;
    },
    
    /**
     * Process a prompt by sanitizing it
     * 
     * @param prompt The prompt to process
     * @param options Options for the preprocessor
     * @returns The sanitized prompt
     */
    async process(prompt: string, options?: PreprocessorOptions): Promise<string> {
      logger.debug('Sanitizing prompt');
      
      try {
        if (!prompt) {
          return '';
        }
        
        let result = prompt;
        const sanitizationOptions = options?.sanitization || {};
        
        // Remove HTML tags
        if (sanitizationOptions.removeHtmlTags !== false) {
          result = result.replace(/<[^>]*>/g, '');
        }
        
        // Remove script tags specifically (more aggressive than removeHtmlTags)
        if (sanitizationOptions.removeScriptTags !== false) {
          result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        
        // Remove URLs
        if (sanitizationOptions.removeUrls) {
          result = result.replace(/https?:\/\/\S+/g, '[URL REMOVED]');
        }
        
        // Remove email addresses
        if (sanitizationOptions.removeEmails) {
          result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REMOVED]');
        }
        
        // Remove personal information (simple patterns)
        if (sanitizationOptions.removePersonalInfo) {
          // Remove phone numbers (simple pattern)
          result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REMOVED]');
          
          // Remove SSN-like patterns
          result = result.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, '[SSN REMOVED]');
        }
        
        // Apply custom patterns
        if (sanitizationOptions.customPatterns && Array.isArray(sanitizationOptions.customPatterns)) {
          for (const pattern of sanitizationOptions.customPatterns) {
            result = result.replace(pattern, '[CUSTOM PATTERN REMOVED]');
          }
        }
        
        logger.debug('Prompt sanitized');
        return result;
      } catch (error) {
        logger.error('Error sanitizing prompt', error);
        throw new PreprocessorError(`Error in sanitization preprocessor: ${error instanceof Error ? error.message : String(error)}`, 'sanitization');
      }
    }
  };
}