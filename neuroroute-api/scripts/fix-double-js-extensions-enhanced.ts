#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root directory of the project (parent of scripts directory)
const rootDir = path.resolve(__dirname, '..');

// Extensions to process
const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

// Regex patterns to match double .js.js extensions in different contexts
const patterns = [
  // Static imports: import x from './path.js'
  /from\s+['"](\.[^'"]*\.js\.js)['"]/g,
  
  // Dynamic imports: import('./path.js')
  /import\s*\(\s*['"](\.[^'"]*\.js\.js)['"]\s*\)/g,
  
  // Export from: export x from './path.js'
  /export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"](\.[^'"]*\.js\.js)['"]/g,
  
  // Require: require('./path.js')
  /require\s*\(\s*['"](\.[^'"]*\.js\.js)['"]\s*\)/g,
  
  // TypeScript references: <reference path="./path.js" />
  /<reference\s+path\s*=\s*['"](\.[^'"]*\.js\.js)['"]\s*\/>/g,
  
  // Any other string literal with .js.js
  /['"](\.[^'"]*\.js\.js)['"]/g
];

/**
 * Process a file to fix double .js.js extensions
 * 
 * @param filePath Path to the file to process
 */
function processFile(filePath: string): void {
  console.log(`Processing ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let newContent = content;
    
    // Process each pattern
    for (const pattern of patterns) {
      newContent = newContent.replace(pattern, (match, importPath: string) => {
        // Replace .js.js with .js
        modified = true;
        return match.replace(importPath, importPath.replace('.js.js', '.js'));
      });
    }
    
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Fixed double .js.js extensions in ${filePath}`);
    } else {
      console.log(`✓ No double .js.js extensions found in ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err);
  }
}

/**
 * Recursively find all files with specified extensions in a directory
 * 
 * @param dir Directory to search in
 * @returns Array of file paths
 */
function findFiles(dir: string): string[] {
  const files: string[] = [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and dist directories
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...findFiles(fullPath));
      }
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Main function to find and process all files
 */
function main(): void {
  console.log('🔍 Finding files to process...');
  const files = findFiles(rootDir);
  console.log(`📁 Found ${files.length} files to check for double .js.js extensions`);
  
  let processedCount = 0;
  let fixedCount = 0;
  
  for (const file of files) {
    const originalContent = fs.readFileSync(file, 'utf8');
    processFile(file);
    const newContent = fs.readFileSync(file, 'utf8');
    
    processedCount++;
    if (originalContent !== newContent) {
      fixedCount++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`Total files processed: ${processedCount}`);
  console.log(`Files with fixed double .js.js extensions: ${fixedCount}`);
  console.log(`Files unchanged: ${processedCount - fixedCount}`);
  console.log('\n✅ Done!');
}

main();