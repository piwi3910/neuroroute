/**
 * Replacement Preprocessor
 * 
 * This preprocessor replaces patterns in prompts.
 */

import { createLogger } from '../../../utils/logger.js';
import { Preprocessor, PreprocessorOptions, PreprocessorError } from '../interfaces.js';

const logger = createLogger({
  level: 'info',
  prettyPrint: true
});

/**
 * Create a replacement preprocessor
 * 
 * @returns A replacement preprocessor
 */
export function createReplacementPreprocessor(): Preprocessor {
  logger.debug('Creating replacement preprocessor');
  
  return {
    name: 'replacement',
    
    /**
     * Check if the preprocessor is enabled
     * 
     * @param options Options for the preprocessor
     * @returns True if the preprocessor is enabled, false otherwise
     */
    isEnabled(options?: PreprocessorOptions): boolean {
      return options?.replacement?.enabled === true;
    },
    
    /**
     * Process a prompt by replacing patterns
     * 
     * @param prompt The prompt to process
     * @param options Options for the preprocessor
     * @returns The processed prompt
     */
    async process(prompt: string, options?: PreprocessorOptions): Promise<string> {
      logger.debug('Replacing patterns in prompt');
      
      try {
        if (!prompt) {
          return '';
        }
        
        let result = prompt;
        const replacementOptions = options?.replacement || {};
        
        // Apply replacement patterns
        if (replacementOptions.patterns && Array.isArray(replacementOptions.patterns)) {
          const patterns = replacementOptions.patterns;
          let replacementCount = 0;
          const maxReplacements = replacementOptions.maxReplacements || Number.MAX_SAFE_INTEGER;
          
          for (const pattern of patterns) {
            if (replacementCount >= maxReplacements) {
              break;
            }
            
            const { pattern: searchPattern, replacement, useRegex, ignoreCase } = pattern;
            
            if (!searchPattern || typeof searchPattern !== 'string') {
              continue;
            }
            
            // Determine if we should use regex
            const shouldUseRegex = useRegex ?? replacementOptions.useRegex ?? false;
            
            // Determine if we should ignore case
            const shouldIgnoreCase = ignoreCase ?? replacementOptions.ignoreCase ?? false;
            
            if (shouldUseRegex) {
              // Create regex with appropriate flags
              const flags = shouldIgnoreCase ? 'gi' : 'g';
              const regex = new RegExp(searchPattern, flags);
              
              // Count replacements
              const matches = result.match(regex);
              const matchCount = matches ? matches.length : 0;
              
              // Apply replacement
              result = result.replace(regex, replacement || '');
              
              // Update replacement count
              replacementCount += matchCount;
            } else {
              // Simple string replacement
              let tempResult = '';
              let remainingText = result;
              const searchText = shouldIgnoreCase ? searchPattern.toLowerCase() : searchPattern;
              
              while (remainingText.length > 0) {
                const index = shouldIgnoreCase
                  ? remainingText.toLowerCase().indexOf(searchText)
                  : remainingText.indexOf(searchText);
                
                if (index === -1 || replacementCount >= maxReplacements) {
                  tempResult += remainingText;
                  break;
                }
                
                // Add text before match
                tempResult += remainingText.substring(0, index);
                
                // Add replacement
                tempResult += replacement || '';
                
                // Update remaining text
                remainingText = remainingText.substring(index + searchPattern.length);
                
                // Update replacement count
                replacementCount++;
              }
              
              result = tempResult;
            }
          }
        }
        
        logger.debug(`Replaced ${replacementOptions.patterns?.length || 0} patterns in prompt`);
        return result;
      } catch (error) {
        logger.error('Error replacing patterns in prompt', error);
        throw new PreprocessorError(`Error in replacement preprocessor: ${error instanceof Error ? error.message : String(error)}`, 'replacement');
      }
    }
  };
}