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
const extensions = ['.ts', '.tsx', '.mts', '.cts'];

// Regex patterns for different import styles
const staticImportRegex = /from\s+['"](\.[^'"]*)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g;
const exportFromRegex = /export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"](\.[^'"]*)['"]/g;

/**
 * Process a file to fix import/export statements for ESM compatibility
 * 
 * This function:
 * 1. Replaces .ts extensions with .js in imports/exports
 * 2. Adds .js extensions to imports/exports that don't have extensions
 * 
 * @param filePath Path to the file to process
 */
function processFile(filePath: string): void {
  console.log(`Processing ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let newContent = content;
    
    // Function to process imports/exports
    const processImport = (match: string, importPath: string): string => {
      // Skip non-relative imports (e.g., 'fastify', '@fastify/cors')
      if (!importPath.startsWith('.')) {
        return match;
      }
      
      // Get the extension of the import path
      const ext = path.extname(importPath);
      
      // If it has a .ts extension, replace it with .js
      if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
        modified = true;
        return match.replace(importPath, importPath.replace(ext, '.js'));
      }
      
      // If it has no extension, add .js
      if (ext === '') {
        modified = true;
        return match.replace(importPath, `${importPath}.js`);
      }
      
      // If it already has the correct extension (.js, .mjs, .cjs), leave it as is
      return match;
    };
    
    // Process static imports (import ... from '...')
    newContent = newContent.replace(staticImportRegex, (match: string, importPath: string) => {
      return processImport(match, importPath);
    });
    
    // Process dynamic imports (import('...'))
    newContent = newContent.replace(dynamicImportRegex, (match: string, importPath: string) => {
      return processImport(match, importPath);
    });
    
    // Process export from statements (export ... from '...')
    newContent = newContent.replace(exportFromRegex, (match: string, importPath: string) => {
      return processImport(match, importPath);
    });
    
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Updated ${filePath}`);
    } else {
      console.log(`✓ No changes needed in ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err);
  }
}

/**
 * Recursively find all TypeScript files in a directory
 * 
 * @param dir Directory to search in
 * @returns Array of file paths
 */
function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and dist directories
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...findTypeScriptFiles(fullPath));
      }
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Main function to find and process all TypeScript files
 */
function main(): void {
  console.log('🔍 Finding TypeScript files...');
  const files = findTypeScriptFiles(rootDir);
  console.log(`📁 Found ${files.length} TypeScript files`);
  
  let processedCount = 0;
  let updatedCount = 0;
  
  for (const file of files) {
    const originalContent = fs.readFileSync(file, 'utf8');
    processFile(file);
    const newContent = fs.readFileSync(file, 'utf8');
    
    processedCount++;
    if (originalContent !== newContent) {
      updatedCount++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`Total files processed: ${processedCount}`);
  console.log(`Files updated: ${updatedCount}`);
  console.log(`Files unchanged: ${processedCount - updatedCount}`);
  console.log('\n✅ Done!');
}

main();