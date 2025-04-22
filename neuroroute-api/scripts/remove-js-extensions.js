#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Root directory of the project (parent of scripts directory)
const rootDir = path.resolve(__dirname, '..');

// Extensions to process
const extensions = ['.ts', '.tsx', '.mts', '.cts'];

// Regex to match imports with .js extensions
const importRegex = /from\s+['"](\.[^'"]*\.js)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"](\.[^'"]*\.js)['"]\s*\)/g;

// Function to process a file
function processFile(filePath) {
  console.log(`Processing ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Create a new content string with replacements
    let newContent = content.replace(importRegex, (match) => {
      modified = true;
      return match.replace('.js', '');
    });
    
    // Also handle dynamic imports
    newContent = newContent.replace(dynamicImportRegex, (match) => {
      modified = true;
      return match.replace('.js', '');
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
function findTypeScriptFiles(dir) {
  const files = [];
  
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
function main() {
  console.log('Finding TypeScript files...');
  const files = findTypeScriptFiles(rootDir);
  console.log(`Found ${files.length} TypeScript files`);
  
  for (const file of files) {
    processFile(file);
  }
  
  console.log('Done!');
}

main();