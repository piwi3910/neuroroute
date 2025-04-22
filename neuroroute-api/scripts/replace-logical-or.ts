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

// Regex to match potential logical OR patterns for default values
// This regex looks for variable assignments or declarations with || for default values
// It captures the left-hand side and right-hand side of the || operator
const logicalOrRegex = /(\w+(?:\.\w+)*|\[[^\]]+\])\s*(\|\|)\s*([^;,)\]]+)/g;

// Function to process a file
function processFile(filePath: string): void {
  console.log(`Processing ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Create a new content string with replacements
    const newContent = content.replace(logicalOrRegex, (match, leftSide, operator, rightSide) => {
      // Skip replacements in comments
      const lineStart = content.lastIndexOf('\n', content.indexOf(match)) + 1;
      const lineEnd = content.indexOf('\n', content.indexOf(match));
      const line = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length);
      
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
        return match;
      }
      
      // Skip replacements in string literals
      const beforeMatch = content.substring(0, content.indexOf(match));
      const quotesBeforeMatch = (beforeMatch.match(/["'`]/g) ?? []).length;
      if (quotesBeforeMatch % 2 !== 0) {
        return match;
      }
      
      // Skip boolean expressions (common patterns)
      if (
        // Skip boolean expressions like "if (a || b)" or "while (a || b)"
        /if\s*\([^)]*\|\|/.test(line) ||
        /while\s*\([^)]*\|\|/.test(line) ||
        /for\s*\([^)]*\|\|/.test(line) ||
        // Skip ternary expressions
        /\?\s*[^:]*\|\|/.test(line) ||
        // Skip return statements that are likely boolean expressions
        /return\s+\w+\s*\|\|\s*\w+/.test(line) ||
        // Skip boolean assignments
        /=\s*\w+\s*\|\|\s*\w+\s*;/.test(line) ||
        // Skip boolean expressions in array methods
        /\.(filter|some|every|find)\s*\([^)]*\|\|/.test(line)
      ) {
        return match;
      }
      
      // Focus on default value assignments
      // Look for patterns like "const x = a || b" or "let x = a || b" or "x = a || b"
      if (
        /(?:const|let|var)\s+\w+\s*=\s*[^=]*\|\|/.test(line) ||
        /\w+\s*=\s*[^=]*\|\|/.test(line) ||
        // Object property default values
        /\w+\s*:\s*[^:,]*\|\|/.test(line) ||
        // Function parameter default values
        /\(\s*[^)]*\|\|/.test(line)
      ) {
        return `${leftSide} ?? ${rightSide}`;
      }
      
      // If we're not sure, keep the original
      return match;
    });
    
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
      modified = true;
    }
    
    if (!modified) {
      console.log(`No changes needed in ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
  }
}

// Function to recursively find all files with specified extensions
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

// Main function
function main(): void {
  console.log('Finding files...');
  const files = findFiles(rootDir);
  console.log(`Found ${files.length} files to process`);
  
  for (const file of files) {
    processFile(file);
  }
  
  console.log('Done!');
}

main();