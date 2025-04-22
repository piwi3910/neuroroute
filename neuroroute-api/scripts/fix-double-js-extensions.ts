#!/usr/bin/env node

/**
 * Fix Double JS Extensions
 * 
 * This script fixes double .js extensions that might occur during ESM migration
 * (e.g., './utils.js.js' -> './utils.js')
 * 
 * Usage:
 *   npx ts-node scripts/fix-double-js-extensions.ts
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Configuration
const EXTENSIONS_TO_PROCESS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**'];

// Regex patterns
const DOUBLE_JS_REGEX = /(['"])([^'"]+)\.js\.js(['"])/g;

// Track statistics
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  importsFixed: 0,
  errors: 0
};

/**
 * Fix double .js extensions in a file
 */
function fixDoubleExtensions(filePath: string): void {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fixCount = 0;

    // Fix double .js extensions
    const newContent = content.replace(DOUBLE_JS_REGEX, (match, quote1, path, quote2) => {
      modified = true;
      fixCount++;
      return `${quote1}${path}.js${quote2}`;
    });

    // Write back to file if modified
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      stats.filesModified++;
      stats.importsFixed += fixCount;
      console.log(`✅ Fixed ${fixCount} double extensions in ${filePath}`);
    }

    stats.filesProcessed++;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    stats.errors++;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Searching for files to process...');
  
  // Find all files to process
  const files = await glob(`**/*{${EXTENSIONS_TO_PROCESS.join(',')}}`, {
    cwd: process.cwd(),
    ignore: IGNORE_PATTERNS,
    absolute: true
  });
  
  console.log(`Found ${files.length} files to process`);
  
  // Process each file
  for (const file of files) {
    fixDoubleExtensions(file);
  }
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Double extensions fixed: ${stats.importsFixed}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (stats.errors > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});