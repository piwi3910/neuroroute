import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disable import extensions rule since we're using ESM
      'import/extensions': 'off',
      // Ensure correct import extensions for ESM
      'import/no-unresolved': 'off', // TypeScript handles this
      // Add rules to fix common TypeScript issues
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for now
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      'no-undef': 'off', // TypeScript handles this
    },
  },
  // Disable type checking for JavaScript files
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
