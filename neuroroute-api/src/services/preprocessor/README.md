# Preprocessor Service

The Preprocessor Service is a modular component of the NeuroRoute API that handles initial prompt processing before it's passed to the classifier and router. It's designed with a plugin architecture to allow for easy extension with new processors.

## Architecture

The Preprocessor Service follows a plugin-based architecture where each preprocessor is a separate module that can be registered with the service. The service then processes prompts through all enabled preprocessors in the order they were registered.

### Key Components

- **PreprocessorService**: The main entry point for the service, responsible for registering preprocessors and processing prompts.
- **PreprocessorRegistry**: Manages the collection of registered preprocessors.
- **Preprocessor**: Interface that all preprocessors must implement.
- **Processors**: Individual preprocessor implementations (sanitization, compression, replacement).

## Usage

```typescript
import { createPreprocessorService } from './services/preprocessor';

// Create the service
const preprocessorService = createPreprocessorService();

// Process a prompt
const processedPrompt = await preprocessorService.process('Your prompt here', {
  // Options for the preprocessors
  sanitization: {
    enabled: true,
    removeHtmlTags: true,
    removeScriptTags: true,
    removeUrls: false,
    removeEmails: false,
    removePersonalInfo: false
  },
  compression: {
    enabled: false
  },
  replacement: {
    enabled: false
  }
});
```

## Preprocessors

### Sanitization

The sanitization preprocessor removes potentially harmful content from prompts, such as HTML tags, script tags, URLs, email addresses, and personal information.

Options:
- `enabled`: Whether the preprocessor is enabled (default: true)
- `removeHtmlTags`: Whether to remove HTML tags (default: true)
- `removeScriptTags`: Whether to remove script tags (default: true)
- `removeUrls`: Whether to remove URLs (default: false)
- `removeEmails`: Whether to remove email addresses (default: false)
- `removePersonalInfo`: Whether to remove personal information (default: false)
- `customPatterns`: Array of custom patterns to remove (default: [])

### Compression

The compression preprocessor compresses prompts to reduce token usage. Currently, it's a placeholder with basic functionality.

Options:
- `enabled`: Whether the preprocessor is enabled (default: false)
- `removeNewlines`: Whether to remove newlines (default: false)
- `removeExtraSpaces`: Whether to remove extra spaces (default: false)
- `abbreviateCommonWords`: Whether to abbreviate common words (default: false)
- `summarizeLongParagraphs`: Whether to summarize long paragraphs (default: false)
- `maxLength`: Maximum length of the prompt (default: 0, no limit)

### Replacement

The replacement preprocessor replaces patterns in prompts based on configured rules.

Options:
- `enabled`: Whether the preprocessor is enabled (default: false)
- `patterns`: Array of patterns to replace (default: [])
- `useRegex`: Whether to use regex for pattern matching (default: false)
- `ignoreCase`: Whether to ignore case when matching (default: false)
- `maxReplacements`: Maximum number of replacements to make (default: Infinity)

## Extending

To create a new preprocessor, implement the `Preprocessor` interface:

```typescript
import { Preprocessor, PreprocessorOptions } from './interfaces';

export function createMyPreprocessor(): Preprocessor {
  return {
    name: 'my-preprocessor',
    
    isEnabled(options?: PreprocessorOptions): boolean {
      return options?.myPreprocessor?.enabled === true;
    },
    
    async process(prompt: string, options?: PreprocessorOptions): Promise<string> {
      // Process the prompt
      return prompt;
    }
  };
}
```

Then register it with the service:

```typescript
import { createPreprocessorService } from './services/preprocessor';
import { createMyPreprocessor } from './services/preprocessor/processors/my-preprocessor';

const preprocessorService = createPreprocessorService();
preprocessorService.registerPreprocessor(createMyPreprocessor());
```

## Error Handling

The preprocessor service handles errors gracefully. If a preprocessor throws an error, the service will log the error and continue with the next preprocessor. The error will be wrapped in a `PreprocessorError` with the name of the preprocessor that caused the error.