# ESM Migration Guide

This document outlines the process of migrating the NeuroRoute API project from CommonJS to ECMAScript Modules (ESM) and provides guidelines for maintaining ESM compatibility.

## Background

Node.js has two module systems:
- **CommonJS (CJS)**: The original module system (`require()`, `module.exports`)
- **ECMAScript Modules (ESM)**: The standardized JavaScript module system (`import`, `export`)

ESM offers several advantages:
- Standard JavaScript syntax
- Better static analysis
- Top-level await
- Tree-shaking for smaller bundles
- Better compatibility with modern JavaScript tools and libraries

## Migration Changes

The following changes were made to migrate the project to ESM:

1. **Package.json Configuration**
   - Added `"type": "module"` to specify that the project uses ESM
   - Updated build script to fix import extensions after TypeScript compilation

2. **TypeScript Configuration**
   - Updated `tsconfig.json` to use proper ESM settings:
     - Set `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`
     - Disabled `"allowImportingTsExtensions": true` (not compatible with compiled output)
     - Disabled `"noEmit": true` to allow JavaScript file generation
   
3. **Import Paths**
   - Created a comprehensive script to fix import extensions
   - Ensured all relative imports use `.js` extensions (not `.ts`)
   - Fixed dynamic imports to use correct extensions

4. **ESLint Configuration**
   - Added rules to enforce correct import extensions

5. **Module Detection**
   - Replaced CommonJS-style module detection (`require.main === module`) with ESM-compatible approach using `import.meta.url`

## Guidelines for ESM Compatibility

### Import Statements

1. **Always use `.js` extensions for relative imports in TypeScript files**

   ```typescript
   // Correct
   import { something } from './utils.js';
   
   // Incorrect - will fail at runtime
   import { something } from './utils';
   import { something } from './utils.ts';
   ```

2. **Use the correct extension in dynamic imports**

   ```typescript
   // Correct
   const module = await import('./dynamic-module.js');
   
   // Incorrect
   const module = await import('./dynamic-module');
   ```

3. **Package imports (non-relative) don't need extensions**

   ```typescript
   // Correct
   import fastify from 'fastify';
   import { z } from 'zod';
   ```

### Module Detection

When checking if a file is being run directly (not imported):

```typescript
// Correct (ESM)
const isMainModule = import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ''));
if (isMainModule) {
  // This file is being run directly
}

// Incorrect (CommonJS)
if (require.main === module) {
  // This won't work in ESM
}
```

### File Paths and URLs

In ESM, `__dirname` and `__filename` are not available. Use this pattern instead:

```typescript
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### Build Process

The build process has been updated to automatically fix import extensions:

1. TypeScript compiles `.ts` files to `.js` files
2. The `fix:esm-comprehensive` script runs to ensure all imports have correct extensions

To build the project:

```bash
npm run build
```

This will:
1. Run the TypeScript compiler
2. Fix all import extensions in the compiled JavaScript files

### Troubleshooting Common ESM Issues

1. **"Cannot use import statement outside a module"**
   - Ensure `"type": "module"` is in package.json
   - Check that you're using Node.js version 14+ (preferably 16+)

2. **"ERR_MODULE_NOT_FOUND"**
   - Check that import paths include `.js` extensions for relative imports
   - Verify the file actually exists at the specified path

3. **"SyntaxError: The requested module does not provide an export named..."**
   - Ensure the imported module actually exports the named export
   - Check for typos in the import name

4. **"TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension .ts"**
   - You're trying to import a `.ts` file directly in ESM
   - Change the import to use `.js` extension instead

## Testing ESM Compatibility

To verify that the ESM migration was successful:

1. Build the project: `npm run build`
2. Start the server: `npm start`
3. Run the tests: `npm test`

If all of these steps complete without errors, the ESM migration was successful.