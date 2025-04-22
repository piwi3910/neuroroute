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

// Regex to match relative imports without extensions
const importRegex = /from\s+['"](\.[^'"]*)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g;

// Function to check if a file exists
function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

// Function to determine the correct extension to add
function getCorrectExtension(importPath: string, currentFilePath: string): string | null {
  const dir = path.dirname(currentFilePath);
  const absoluteImportPath = path.resolve(dir, importPath);
  
  // Check if the import path exists with a TypeScript extension
  for (const ext of extensions) {
    if (fileExists(`${absoluteImportPath}${ext}`)) {
      return ext;
    }
  }
  
  // Check if the import path exists as a directory with an index file
  for (const ext of extensions) {
    if (fileExists(path.join(absoluteImportPath, `index${ext}`))) {
      return `/index${ext}`;
    }
  }
  
  // If we can't determine the extension, return null
  return null;
}

// Function to process a file
function processFile(filePath: string): void {
  console.log(`Processing ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Create a new content string with replacements
    let newContent = content.replace(importRegex, (match, importPath: string) => {
      // Skip if the import already has an extension
      if (path.extname(importPath) !== '') {
        return match;
      }
      
      // Skip non-relative imports
      if (!importPath.startsWith('.')) {
        return match;
      }
      
      const extension = getCorrectExtension(importPath, filePath);
      
      if (extension) {
        modified = true;
        return match.replace(importPath, `${importPath}${extension}`);
      }
      
      return match;
    });
    
    // Also handle dynamic imports
    newContent = newContent.replace(dynamicImportRegex, (match, importPath: string) => {
      // Skip if the import already has an extension
      if (path.extname(importPath) !== '') {
        return match;
      }
      
      // Skip non-relative imports
      if (!importPath.startsWith('.')) {
        return match;
      }
      
      const extension = getCorrectExtension(importPath, filePath);
      
      if (extension) {
        modified = true;
        return match.replace(importPath, `${importPath}${extension}`);
      }
      
      return match;
    });
    
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
    } else {
      console.log(`No changes needed in ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
  }
}

// Function to recursively find all TypeScript files
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

// Main function
function main(): void {
  console.log('Finding TypeScript files...');
  const files = findTypeScriptFiles(rootDir);
  console.log(`Found ${files.length} TypeScript files`);
  
  for (const file of files) {
    processFile(file);
  }
  
  console.log('Done!');
}

main();