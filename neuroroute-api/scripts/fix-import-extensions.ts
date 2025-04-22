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

// Extensions to add to imports
const validExtensions = ['.js', '.jsx', '.mjs', '.cjs', '.json'];

// Regex to match relative imports without extensions
const importRegex = /from\s+['"](\.[^'"]*)['"]/g;
const importTypeRegex = /import\s+type\s+.*?from\s+['"](\.[^'"]*)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g;

// Function to check if a file exists
function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

// Function to determine the correct extension to add
function getCorrectExtension(importPath: string, currentFilePath: string): string | null {
  const dir = path.dirname(currentFilePath);
  const absoluteImportPath = path.resolve(dir, importPath);
  
  // Check if the import path exists with any of the valid extensions
  for (const ext of validExtensions) {
    if (fileExists(`${absoluteImportPath}${ext}`)) {
      return ext;
    }
  }
  
  // Check if the import path exists as a directory with an index file
  for (const ext of validExtensions) {
    if (fileExists(path.join(absoluteImportPath, `index${ext}`))) {
      return `/index${ext}`;
    }
  }
  
  // If we can't determine the extension, check if the source file exists
  for (const ext of extensions) {
    if (fileExists(`${absoluteImportPath}${ext}`)) {
      // Convert source extension to output extension
      const sourceExt = ext;
      const outputExt = sourceExt.replace(/\.tsx?$/, '.js').replace(/\.mts$/, '.mjs').replace(/\.cts$/, '.cjs');
      return outputExt;
    }
  }
  
  // If we still can't determine, check for index files with source extensions
  for (const ext of extensions) {
    if (fileExists(path.join(absoluteImportPath, `index${ext}`))) {
      const sourceExt = ext;
      const outputExt = sourceExt.replace(/\.tsx?$/, '.js').replace(/\.mts$/, '.mjs').replace(/\.cts$/, '.cjs');
      return `/index${outputExt}`;
    }
  }
  
  // If we can't determine the extension, return null
  return null;
}

// Function to process a file
function processFile(filePath: string): void {
  console.log(`Processing ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Skip type-only imports
    const typeImports = new Set<string>();
    let typeMatch;
    while ((typeMatch = importTypeRegex.exec(content)) !== null) {
      typeImports.add(typeMatch[1]);
    }
    
    // Process regular imports
    let match;
    let newContent = content;
    
    // Reset regex state
    importRegex.lastIndex = 0;
    
    while ((match = importRegex.exec(content)) !== null) {
      const [fullMatch, importPath] = match;
      
      // Skip if this is a type-only import
      if (typeImports.has(importPath)) {
        continue;
      }
      
      // Skip if the import already has an extension
      if (validExtensions.some(ext => importPath.endsWith(ext))) {
        continue;
      }
      
      // Skip non-relative imports
      if (!importPath.startsWith('.')) {
        continue;
      }
      
      const extension = getCorrectExtension(importPath, filePath);
      
      if (extension) {
        const newImport = fullMatch.replace(importPath, `${importPath}${extension}`);
        newContent = newContent.replace(fullMatch, newImport);
        modified = true;
      }
    }
    
    // Process dynamic imports
    dynamicImportRegex.lastIndex = 0;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const [fullMatch, importPath] = match;
      
      // Skip if the import already has an extension
      if (validExtensions.some(ext => importPath.endsWith(ext))) {
        continue;
      }
      
      // Skip non-relative imports
      if (!importPath.startsWith('.')) {
        continue;
      }
      
      const extension = getCorrectExtension(importPath, filePath);
      
      if (extension) {
        const newImport = fullMatch.replace(importPath, `${importPath}${extension}`);
        newContent = newContent.replace(fullMatch, newImport);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
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