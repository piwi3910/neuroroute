import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce .js extensions in imports for ESM compatibility
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          'js': 'never',
          'ts': 'never',
          'tsx': 'never',
          'mts': 'never',
          'cts': 'never'
        }
      ],
      // Ensure correct import extensions for ESM
      'import/no-unresolved': 'off', // TypeScript handles this
    },
  },
  // Disable type checking for JavaScript files
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
