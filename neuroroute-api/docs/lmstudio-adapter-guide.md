# LMStudio Adapter Guide

## Overview

The LMStudio adapter provides integration with LMStudio's local API server, which offers an OpenAI-compatible API for local LLM inference. This adapter has been enhanced to support a wide range of features including conversation history, function calling, tool usage, error handling with retries and circuit breaker, and streaming support.

## Features

### 1. Conversation History

The enhanced LMStudio adapter now supports full conversation history with multiple messages of different types:
- System messages
- User messages
- Assistant messages
- Function messages
- Tool messages

This allows for multi-turn conversations and maintaining context across interactions.

### 2. Function Calling

The adapter supports function calling, allowing the model to:
- Receive function definitions
- Call functions with arguments
- Process function results
- Continue the conversation with function outputs

Function calling is particularly useful for tasks that require external data or actions, such as retrieving weather information, searching databases, or performing calculations.

### 3. Tool Usage

Similar to function calling, the adapter supports tool usage:
- Define tools with their capabilities
- Allow the model to choose which tool to use
- Process tool results
- Continue the conversation with tool outputs

Tools provide a more structured way to extend the model's capabilities with external systems.

### 4. Error Handling and Resilience

The adapter includes robust error handling mechanisms:
- Retries with exponential backoff and jitter for transient errors
- Circuit breaker pattern to prevent cascading failures
- Error classification for appropriate handling
- Detailed logging for troubleshooting

These features ensure the adapter can gracefully handle network issues, rate limits, and other common API problems.

### 5. Streaming Support

The adapter supports streaming responses, which:
- Provides real-time output as the model generates it
- Reduces perceived latency for users
- Supports streaming of function calls and tool usage
- Includes proper error handling in streaming mode

## Configuration

The LMStudio adapter can be configured through:
1. Environment variables
2. Configuration manager
3. Direct parameter passing

### Environment Variables

- `LMSTUDIO_URL`: The base URL for the LMStudio API (default: http://localhost:1234/v1)
- `LMSTUDIO_TIMEOUT`: Request timeout in milliseconds (default: 60000)

### Configuration Manager

If a configuration manager is available in the Fastify instance, the adapter will use it to retrieve configuration values:

```typescript
// Example configuration retrieval
const url = await configManager.get<string>('LMSTUDIO_URL', defaultUrl);
const timeout = await configManager.get<number>('LMSTUDIO_TIMEOUT', defaultTimeout);
```

## Usage Examples

### Basic Completion

```typescript
const adapter = new LMStudioAdapter(fastify, 'llama3');
const response = await adapter.generateCompletion(
  'What are the three laws of robotics?',
  {
    systemMessage: 'You are a helpful AI assistant with expertise in science fiction literature.',
    temperature: 0.7,
    maxTokens: 500
  }
);
console.log(response.text);
```

### Conversation History

```typescript
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello, how are you?' },
  { role: 'assistant', content: 'I am doing well, thank you for asking.' },
  { role: 'user', content: 'Tell me about conversation history.' }
];

const response = await adapter.generateCompletion('', { messages });
console.log(response.text);

// Add the response to the conversation
messages.push({
  role: 'assistant',
  content: response.text
});

// Continue the conversation
messages.push({
  role: 'user',
  content: 'Can you elaborate on that?'
});

const followUpResponse = await adapter.generateCompletion('', { messages });
console.log(followUpResponse.text);
```

### Function Calling

```typescript
const functions = [
  {
    name: 'get_weather',
    description: 'Get the current weather in a given location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'The temperature unit to use',
        },
      },
      required: ['location'],
    },
  }
];

const response = await adapter.generateCompletion(
  'What is the weather like in San Francisco?',
  {
    functions,
    functionCall: 'auto',
    temperature: 0.2
  }
);

if (response.functionCall) {
  const { name, arguments: args } = response.functionCall;
  const parsedArgs = JSON.parse(args);
  
  // Execute the function
  const functionResult = getWeather(parsedArgs.location, parsedArgs.unit);
  
  // Continue the conversation with the function result
  const messages = [
    ...(response.messages || []),
    {
      role: 'function',
      name: 'get_weather',
      content: JSON.stringify(functionResult)
    }
  ];
  
  const followUpResponse = await adapter.generateCompletion('', { messages });
  console.log(followUpResponse.text);
}
```

### Streaming

```typescript
const stream = adapter.generateCompletionStream(
  'Tell me a story about a space explorer.',
  {
    temperature: 0.7,
    maxTokens: 1000
  }
);

for await (const chunk of stream) {
  if (chunk.error) {
    console.error('Stream error:', chunk.errorDetails);
    break;
  }
  
  process.stdout.write(chunk.chunk);
  
  if (chunk.done) {
    console.log('\nStream finished.');
    break;
  }
}
```

## Error Handling

The adapter includes comprehensive error handling:

```typescript
try {
  const response = await adapter.generateCompletion(
    'This is a test prompt',
    {
      maxRetries: 3,
      initialBackoff: 1000 // 1 second
    }
  );
  console.log(response.text);
} catch (error) {
  if (error.code === 'MODEL_RATE_LIMITED') {
    console.log('Rate limited, try again later');
  } else if (error.code === 'MODEL_CONTEXT_LENGTH') {
    console.log('Input is too long for the model');
  } else {
    console.error('Error:', error.message);
  }
}
```

## Implementation Details

### Circuit Breaker Pattern

The adapter implements the circuit breaker pattern to prevent cascading failures:

1. **Closed State**: Normal operation, requests are allowed
2. **Open State**: After multiple failures, requests are blocked without attempting to call the API
3. **Half-Open State**: After a timeout period, a single request is allowed to test if the service has recovered

This pattern improves system resilience and prevents overwhelming the LMStudio API during outages.

### Token Counting

The adapter provides token counting functionality:

```typescript
const tokenCount = adapter.countTokens('This is a test string');
console.log(`Estimated token count: ${tokenCount}`);
```

Note that the token counting is approximate unless LMStudio provides a tokenizer API.

## Compatibility

The LMStudio adapter is designed to be compatible with:

- LMStudio's OpenAI-compatible API
- Various LLM models supported by LMStudio
- The BaseModelAdapter interface in the application

## Limitations

- Function calling and tool usage depend on the underlying model's capabilities
- Token counting is approximate
- Performance depends on the local machine running LMStudio

## Troubleshooting

If you encounter issues:

1. Ensure LMStudio is running with the API server enabled
2. Check the URL and port configuration
3. Verify the model is loaded in LMStudio
4. Check the logs for detailed error information
5. Ensure your machine has sufficient resources for the model

## Future Enhancements

Potential future enhancements include:

- Better token counting with model-specific tokenizers
- Support for more advanced LMStudio features as they become available
- Performance optimizations for large context windows
- Integration with more sophisticated caching mechanisms