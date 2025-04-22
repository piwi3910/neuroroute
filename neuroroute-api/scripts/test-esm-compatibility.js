#!/usr/bin/env node

/**
 * This script tests ESM compatibility by importing various modules
 * and verifying they work correctly.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Testing ESM compatibility...');

// Test 1: Basic imports
console.log('\n📋 Test 1: Basic imports');
try {
  console.log('✓ Successfully imported Node.js built-in modules');
} catch (err) {
  console.error('❌ Failed to import Node.js built-in modules:', err);
  process.exit(1);
}

// Test 2: Dynamic imports
console.log('\n📋 Test 2: Dynamic imports');
try {
  const dynamicModule = await import('path');
  console.log('✓ Successfully performed dynamic import');
} catch (err) {
  console.error('❌ Failed to perform dynamic import:', err);
  process.exit(1);
}

// Test 3: Import from local file with .js extension
console.log('\n📋 Test 3: Import from local file with .js extension');
try {
  // Create a temporary test module
  const tempModulePath = path.join(rootDir, 'temp-test-module.js');
  fs.writeFileSync(tempModulePath, 'export const testValue = "ESM works!";\n');
  
  try {
    const { testValue } = await import('../temp-test-module.js');
    console.log(`✓ Successfully imported from local file: ${testValue}`);
  } finally {
    // Clean up the temporary file
    fs.unlinkSync(tempModulePath);
  }
} catch (err) {
  console.error('❌ Failed to import from local file with .js extension:', err);
  process.exit(1);
}

// Test 4: Top-level await
console.log('\n📋 Test 4: Top-level await');
try {
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('✓ Successfully used top-level await');
} catch (err) {
  console.error('❌ Failed to use top-level await:', err);
  process.exit(1);
}

// Test 5: import.meta
console.log('\n📋 Test 5: import.meta');
try {
  console.log(`✓ Successfully accessed import.meta.url: ${import.meta.url}`);
} catch (err) {
  console.error('❌ Failed to access import.meta:', err);
  process.exit(1);
}

console.log('\n✅ All ESM compatibility tests passed!');