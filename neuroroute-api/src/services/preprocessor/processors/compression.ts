/**
 * Compression Preprocessor
 * 
 * This preprocessor compresses prompts to reduce token usage.
 * Currently, it's a placeholder with basic functionality.
 */

import { createLogger } from '../../../utils/logger.js';
import { Preprocessor, PreprocessorOptions, PreprocessorError } from '../interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a compression preprocessor
 * 
 * @returns A compression preprocessor
 */
export function createCompressionPreprocessor(): Preprocessor {
  logger.debug('Creating compression preprocessor');
  
  return {
    name: 'compression',
    
    /**
     * Check if the preprocessor is enabled
     * 
     * @param options Options for the preprocessor
     * @returns True if the preprocessor is enabled, false otherwise
     */
    isEnabled(options?: PreprocessorOptions): boolean {
      return options?.compression?.enabled === true;
    },
    
    /**
     * Process a prompt by compressing it
     * 
     * @param prompt The prompt to process
     * @param options Options for the preprocessor
     * @returns The compressed prompt
     */
    async process(prompt: string, options?: PreprocessorOptions): Promise<string> {
      logger.debug('Compressing prompt');
      
      try {
        if (!prompt) {
          return '';
        }
        
        let result = prompt;
        const compressionOptions = options?.compression || {};
        
        // Remove newlines
        if (compressionOptions.removeNewlines) {
          result = result.replace(/\n+/g, ' ');
        }
        
        // Remove extra spaces
        if (compressionOptions.removeExtraSpaces) {
          result = result.replace(/\s+/g, ' ').trim();
        }
        
        // Abbreviate common words (placeholder implementation)
        if (compressionOptions.abbreviateCommonWords) {
          // This is a simple placeholder implementation
          // In a real implementation, this would be more sophisticated
          const abbreviations: Record<string, string> = {
            'for example': 'e.g.',
            'that is': 'i.e.',
            'with respect to': 're',
            'with regard to': 're',
            'versus': 'vs',
            'etcetera': 'etc.',
            'and so on': 'etc.',
          };
          
          for (const [word, abbr] of Object.entries(abbreviations)) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            result = result.replace(regex, abbr);
          }
        }
        
        // Summarize long paragraphs (placeholder implementation)
        if (compressionOptions.summarizeLongParagraphs) {
          // This is a placeholder for future implementation
          // In a real implementation, this would use NLP techniques
          logger.debug('Summarization of long paragraphs is not implemented yet');
        }
        
        // Enforce maximum length if specified
        if (compressionOptions.maxLength && compressionOptions.maxLength > 0 && result.length > compressionOptions.maxLength) {
          result = result.substring(0, compressionOptions.maxLength) + '...';
        }
        
        logger.debug('Prompt compressed');
        return result;
      } catch (error) {
        logger.error('Error compressing prompt', error);
        throw new PreprocessorError(`Error in compression preprocessor: ${error instanceof Error ? error.message : String(error)}`, 'compression');
      }
    }
  };
}