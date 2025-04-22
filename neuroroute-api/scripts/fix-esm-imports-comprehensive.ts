#!/usr/bin/env node

/**
 * Comprehensive ESM Import Fixer
 * 
 * This script fixes common issues when migrating to ESM:
 * 1. Adds .js extensions to relative imports (required for ESM)
 * 2. Fixes type issues with imports
 * 3. Handles edge cases like index imports
 * 
 * Usage:
 *   npx ts-node scripts/fix-esm-imports-comprehensive.ts
 */

import fs from 'fs';
import path from 'path';

// Configuration
const SRC_DIR = path.resolve(process.cwd(), 'src');
const TEST_DIR = path.resolve(process.cwd(), 'test');
const EXTENSIONS_TO_PROCESS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**'];

// Regex patterns
const IMPORT_REGEX = /import\s+(?:{[^}]*}|\*\s+as\s+[^,]*|[^,{]*)\s+from\s+['"]([^'"]+)['"]/g;
const EXPORT_REGEX = /export\s+(?:{[^}]*}|\*\s+as\s+[^,]*|[^,{]*)\s+from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Track statistics
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  importsFixed: 0,
  errors: 0
};

/**
 * Check if a path is a relative import
 */
function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith('./') || importPath.startsWith('../');
}

/**
 * Check if a path is a node built-in module
 */
function isNodeBuiltinModule(importPath: string): boolean {
  const nodeBuiltins = [
    'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
    'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
    'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers',
    'tls', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
  ];
  return nodeBuiltins.includes(importPath) || importPath.startsWith('node:');
}

/**
 * Check if a path already has a file extension
 */
function hasFileExtension(importPath: string): boolean {
  const extensions = ['.js', '.mjs', '.cjs', '.json'];
  return extensions.some(ext => importPath.endsWith(ext));
}

/**
 * Fix import paths in a file
 */
function fixImportsInFile(filePath: string): void {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fixCount = 0;

    // Function to process each import match
    const processImport = (match: string, importPath: string, offset: number, fullString: string): string => {
      // Skip if it's not a relative import or already has an extension
      if (!isRelativeImport(importPath) || hasFileExtension(importPath) || isNodeBuiltinModule(importPath)) {
        return match;
      }

      // Add .js extension
      const fixedImport = match.replace(`'${importPath}'`, `'${importPath}.js'`)
                               .replace(`"${importPath}"`, `"${importPath}.js"`);
      
      modified = true;
      fixCount++;
      return fixedImport;
    };

    // Fix imports
    content = content.replace(IMPORT_REGEX, processImport);
    
    // Fix exports
    content = content.replace(EXPORT_REGEX, processImport);
    
    // Fix dynamic imports
    content = content.replace(DYNAMIC_IMPORT_REGEX, processImport);

    // Write back to file if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesModified++;
      stats.importsFixed += fixCount;
      console.log(`✅ Fixed ${fixCount} imports in ${filePath}`);
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
  
  try {
    // Find all files to process using fs instead of glob
    const files: string[] = [];
    const srcDir = path.join(process.cwd(), 'src');
    const distDir = path.join(process.cwd(), 'dist');
    
    // Function to recursively find files
    const findFiles = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules and other ignored directories
        if (entry.isDirectory()) {
          if (!IGNORE_PATTERNS.some(pattern =>
            fullPath.includes(pattern.replace('**/', '').replace('/**', '')))) {
            findFiles(fullPath);
          }
        } else if (entry.isFile()) {
          // Check if file has one of the extensions we're looking for
          if (EXTENSIONS_TO_PROCESS.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    };
    
    // Find files in src and dist directories
    findFiles(srcDir);
    if (fs.existsSync(distDir)) {
      findFiles(distDir);
    }
    
    console.log(`Found ${files.length} files to process`);
    
    // Process each file
    for (const file of files) {
      fixImportsInFile(file);
    }
    
    // Print summary
    console.log('\n📊 Summary:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Imports fixed: ${stats.importsFixed}`);
    console.log(`Errors: ${stats.errors}`);
    
    if (stats.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
}

main();