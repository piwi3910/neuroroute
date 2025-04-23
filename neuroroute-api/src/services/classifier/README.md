# Classifier Service

The Classifier Service is responsible for analyzing and classifying user prompts to determine their intent, complexity, and required features. It uses a plugin architecture that allows for different classifier implementations.

## Architecture

The classifier service consists of the following components:

- **Interfaces**: Defines the contract for classifier implementations
- **Registry**: Manages classifier implementations and provides a unified API
- **Classifiers**: Individual classifier implementations (rules-based, ML-based, etc.)

## Directory Structure

```
src/services/classifier/
├── index.ts                 # Main entry point
├── interfaces.ts            # Type definitions and interfaces
├── registry.ts              # Classifier registry
├── classifiers/             # Individual classifier implementations
│   ├── rules-based.ts       # Current rules-based classifier
│   └── ml-based.ts          # Placeholder for future ML-based classifier
└── README.md                # This documentation
```

## Usage

### Basic Usage

```typescript
import { createClassifierService } from './services/classifier';

// Create the classifier service
const classifierService = createClassifierService(fastify);

// Classify a prompt
const result = await classifierService.classifyPrompt('Write a function to calculate Fibonacci numbers');
console.log(result);
// {
//   type: 'code',
//   complexity: 'medium',
//   features: ['code-generation'],
//   priority: 'medium',
//   confidence: 0.85,
//   tokens: { estimated: 15, completion: 50 },
//   language: 'javascript'
// }
```

### Advanced Usage

```typescript
import { createClassifierService } from './services/classifier';
import { createMlBasedClassifier } from './services/classifier/classifiers/ml-based';

// Create the classifier service
const classifierService = createClassifierService(fastify);

// Register a custom classifier
const mlClassifier = createMlBasedClassifier();
classifierService.registry.register(mlClassifier);

// Set it as the default classifier
classifierService.registry.setDefault(mlClassifier.name);

// Classify a prompt using the default classifier
const result = await classifierService.classifyPrompt('Write a function to calculate Fibonacci numbers');
```

## Extending with Custom Classifiers

### Creating a Custom Classifier

To create a custom classifier, implement the `Classifier` interface:

```typescript
import { Classifier, ClassifierOptions, ClassifiedIntent } from '../interfaces';

export function createMyCustomClassifier(): Classifier {
  return {
    name: 'my-custom-classifier',
    
    isEnabled(): boolean {
      return true;
    },
    
    async classify(prompt: string, options?: ClassifierOptions): Promise<ClassifiedIntent> {
      // Your classification logic here
      return {
        type: 'general',
        complexity: 'medium',
        features: ['text-generation'],
        priority: 'medium',
        confidence: 0.7,
        tokens: {
          estimated: Math.ceil(prompt.length / 4),
          completion: Math.ceil(prompt.length / 4)
        }
      };
    }
  };
}
```

### Registering a Custom Classifier

```typescript
import { createClassifierService } from './services/classifier';
import { createMyCustomClassifier } from './services/classifier/classifiers/my-custom';

// Create the classifier service
const classifierService = createClassifierService(fastify);

// Register your custom classifier
const myClassifier = createMyCustomClassifier();
classifierService.registry.register(myClassifier);

// Optionally set it as the default
classifierService.registry.setDefault(myClassifier.name);
```

## Classifier Interface

The `Classifier` interface defines the contract for all classifier implementations:

```typescript
export interface Classifier {
  /**
   * The name of the classifier
   */
  name: string;
  
  /**
   * Check if the classifier is enabled
   */
  isEnabled: () => boolean;
  
  /**
   * Classify a prompt
   * 
   * @param prompt The prompt to classify
   * @param options Optional options for classification
   * @returns The classified intent
   */
  classify: (prompt: string, options?: ClassifierOptions) => Promise<ClassifiedIntent>;
}
```

## Classification Result

The `ClassifiedIntent` interface defines the structure of the classification result:

```typescript
export interface ClassifiedIntent {
  type: string;              // The type of intent (e.g., 'general', 'code', 'creative')
  complexity: string;        // The complexity of the intent (e.g., 'simple', 'medium', 'complex')
  features: string[];        // Features required for this intent
  priority: string;          // The priority of the intent
  confidence: number;        // The confidence of the classification (0-1)
  tokens: {                  // Token estimates
    estimated: number;       // Estimated input tokens
    completion: number;      // Estimated completion tokens
  };
  domain?: string;           // Optional domain of the intent
  language?: string;         // Optional language of the intent
}
```

## Best Practices

1. **Naming**: Use descriptive names for your classifiers
2. **Error Handling**: Implement proper error handling in your classifier
3. **Logging**: Use the logger for debugging and monitoring
4. **Testing**: Write unit tests for your classifier
5. **Documentation**: Document your classifier's behavior and assumptions