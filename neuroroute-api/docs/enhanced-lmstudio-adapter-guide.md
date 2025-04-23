# Enhanced LMStudio Adapter Documentation

## Overview

The LMStudio adapter has been enhanced to fully support the LMStudio API, providing a robust integration between the NeuroRoute API and LMStudio's local inference capabilities. This adapter now offers a comprehensive set of features that enable advanced interactions with LLMs running in LMStudio, including conversation history management, function calling, tool usage, enhanced error handling, and streaming support.

LMStudio provides an OpenAI-compatible API for local LLM inference, allowing you to run powerful language models on your own hardware. The enhanced adapter leverages this API to provide a seamless experience for developers, with features that match or exceed those available in cloud-based LLM services.

## New Features

### Conversation History

The enhanced LMStudio adapter now fully supports multi-turn conversations with complete message history. This allows applications to maintain context across multiple interactions, creating more coherent and contextually aware responses.

Key capabilities:
- Support for all message types: system, user, assistant, function, and tool
- Automatic message history tracking and management
- Seamless context preservation across multiple turns
- Proper handling of different message formats and roles

### Function Calling / Tool Usage

The adapter now supports both function calling and the newer tool usage paradigm, allowing models to request external data or actions during inference.

#### Function Calling
- Define functions with names, descriptions, and parameter schemas
- Allow models to decide when to call functions
- Process function arguments and results
- Continue conversations with function outputs

#### Tool Usage
- Define tools with capabilities and parameter schemas
- Support for multiple tool calls in a single response
- Process tool results and continue conversations
- Structured format for tool definitions and responses

### Enhanced Error Handling

The adapter implements robust error handling mechanisms to ensure reliability in production environments:

- **Retries with Exponential Backoff**: Automatically retries failed requests with increasing delays
- **Jitter**: Adds randomness to retry intervals to prevent thundering herd problems
- **Circuit Breaker Pattern**: Prevents cascading failures by temporarily disabling requests after multiple failures
- **Error Classification**: Properly categorizes errors for appropriate handling
- **Detailed Logging**: Comprehensive logging for troubleshooting and monitoring

### Model Selection and Listing

The adapter supports working with different models available in LMStudio:

- Automatic model capability detection based on model ID
- Support for different model parameters and configurations
- Ability to check model availability before making requests

### Enhanced Streaming Support

Streaming support has been significantly improved:

- Real-time token-by-token responses
- Support for streaming function calls and tool usage
- Proper error handling in streaming mode
- Consistent interface between streaming and non-streaming modes

## API Reference

### Message Types

```typescript
// Base message interface
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}

// System message
interface SystemMessage extends ChatMessage {
  role: 'system';
}

// User message
interface UserMessage extends ChatMessage {
  role: 'user';
}

// Assistant message
interface AssistantMessage extends ChatMessage {
  role: 'assistant';
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}

// Function message
interface FunctionMessage extends ChatMessage {
  role: 'function';
  name: string;
}

// Tool message
interface ToolMessage extends ChatMessage {
  role: 'tool';
  tool_call_id: string;
}
```

### Function and Tool Types

```typescript
// Function call definition
interface FunctionCall {
  name: string;
  arguments: string; // JSON string of arguments
}

// Function definition
interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Tool call definition
interface ToolCall {
  id: string;
  type: string;
  function: FunctionCall;
}

// Tool definition
interface ToolDefinition {
  type: string;
  function: FunctionDefinition;
}
```

### Request Options

```typescript
// LMStudio-specific request options
interface LMStudioRequestOptions extends ModelRequestOptions {
  // Existing options inherited from ModelRequestOptions
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoff?: number;
  
  // New options
  messages?: ChatMessage[];      // Full message history
  systemMessage?: string;        // Shorthand for system message
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}
```

### Response Types

```typescript
// LMStudio API response interface
interface LMStudioResponse extends RawProviderResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    message?: {
      role: string;
      content: string | null;
      function_call?: FunctionCall;
      tool_calls?: ToolCall[];
    };
    delta?: {
      content?: string;
      function_call?: { name?: string; arguments?: string };
      tool_calls?: { index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }[];
    };
    text?: string;
    index: number;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Model response interface
interface ModelResponse {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  processingTime: number;
  raw: any;
  functionCall?: FunctionCall;
  toolCalls?: ToolCall[];
  messages?: ChatMessage[];
}

// Streaming chunk interface
interface StreamingChunk {
  chunk: string;
  done: boolean;
  model: string;
  finishReason?: string;
  error?: boolean;
  errorDetails?: string;
}
```

## Usage Examples

### Basic Usage

The simplest way to use the LMStudio adapter is with a basic prompt:

```typescript
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { LMStudioAdapter } from '../src/models/lmstudio-adapter.js';

// Create a Fastify instance
const fastify = Fastify({
  logger: {
    level: 'info',
  }
});

// Initialize the adapter with a model ID
const modelId = 'llama3';
const adapter = new LMStudioAdapter(fastify, modelId);

// Basic completion with system message
async function basicCompletion() {
  try {
    const response = await adapter.generateCompletion(
      'What are the three laws of robotics?',
      {
        systemMessage: 'You are a helpful AI assistant with expertise in science fiction literature.',
        temperature: 0.7,
        maxTokens: 500
      }
    );
    
    console.log('Response:', response.text);
    console.log('Token usage:', response.tokens);
    console.log('Processing time:', response.processingTime, 'seconds');
  } catch (error) {
    console.error('Error in basic completion:', error);
  }
}

basicCompletion();
```

### Using Conversation History

To maintain context across multiple turns:

```typescript
async function conversationHistory() {
  try {
    // Create a conversation history
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant with expertise in programming.'
      },
      {
        role: 'user',
        content: 'I need help with a JavaScript function.'
      },
      {
        role: 'assistant',
        content: 'I\'d be happy to help with your JavaScript function. What specifically do you need assistance with?'
      },
      {
        role: 'user',
        content: 'How do I write a function to calculate the Fibonacci sequence?'
      }
    ];
    
    const response = await adapter.generateCompletion('', { messages });
    
    console.log('Response:', response.text);
    
    // Add the assistant's response to the conversation
    messages.push({
      role: 'assistant',
      content: response.text
    });
    
    // Continue the conversation
    messages.push({
      role: 'user',
      content: 'Can you optimize that function for better performance?'
    });
    
    const followUpResponse = await adapter.generateCompletion('', { messages });
    
    console.log('Follow-up response:', followUpResponse.text);
  } catch (error) {
    console.error('Error in conversation history:', error);
  }
}
```

### Function Calling

To use function calling capabilities:

```typescript
async function functionCalling() {
  try {
    // Define a function for the model to call
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
      'What is the weather like in San Francisco and New York?',
      {
        functions,
        functionCall: 'auto',
        temperature: 0.2
      }
    );
    
    console.log('Response text:', response.text);
    console.log('Function call:', response.functionCall);
    
    // Handle the function call
    if (response.functionCall) {
      console.log('Handling function call...');
      
      const { name, arguments: args } = response.functionCall;
      const parsedArgs = JSON.parse(args);
      
      console.log(`Function name: ${name}`);
      console.log('Arguments:', parsedArgs);
      
      // Simulate function execution
      const functionResult = {
        location: parsedArgs.location,
        temperature: 72,
        unit: parsedArgs.unit || 'fahrenheit',
        condition: 'sunny'
      };
      
      console.log('Function result:', functionResult);
      
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
      
      console.log('Follow-up response:', followUpResponse.text);
    }
  } catch (error) {
    console.error('Error in function calling:', error);
  }
}
```

### Tool Usage

To use the newer tool usage capabilities:

```typescript
async function toolUsage() {
  try {
    // Define tools for the model to use
    const tools = [
      {
        type: 'function',
        function: {
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
      }
    ];
    
    const response = await adapter.generateCompletion(
      'What is the weather like in Tokyo?',
      {
        tools,
        toolChoice: 'auto',
        temperature: 0.2
      }
    );
    
    console.log('Response text:', response.text);
    console.log('Tool calls:', response.toolCalls);
    
    // Handle the tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('Handling tool calls...');
      
      const toolResponses = [];
      
      for (const toolCall of response.toolCalls) {
        if (toolCall.type === 'function') {
          const { name, arguments: args } = toolCall.function;
          const parsedArgs = JSON.parse(args);
          
          console.log(`Tool function name: ${name}`);
          console.log('Arguments:', parsedArgs);
          
          // Simulate tool execution
          const toolResult = {
            location: parsedArgs.location,
            temperature: 22,
            unit: parsedArgs.unit || 'celsius',
            condition: 'partly cloudy'
          };
          
          console.log('Tool result:', toolResult);
          
          toolResponses.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
      }
      
      // Continue the conversation with the tool results
      const messages = [
        ...(response.messages || []),
        ...toolResponses
      ];
      
      const followUpResponse = await adapter.generateCompletion('', { messages });
      
      console.log('Follow-up response:', followUpResponse.text);
    }
  } catch (error) {
    console.error('Error in tool usage:', error);
  }
}
```

### Streaming

To use streaming for real-time responses:

```typescript
async function streamingWithFunctionCalls() {
  try {
    // Define a function for the model to call
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
    
    console.log('Streaming response:');
    
    // Get the streaming generator
    const stream = adapter.generateCompletionStream(
      'What is the weather like in Paris?',
      {
        functions,
        functionCall: 'auto',
        temperature: 0.2
      }
    );
    
    // Process the stream
    let fullText = '';
    let functionCallData = '';
    
    for await (const chunk of stream) {
      if (chunk.error) {
        console.error('Stream error:', chunk.errorDetails);
        break;
      }
      
      if (chunk.chunk.includes('[Function Call]')) {
        // This is a function call chunk
        functionCallData += chunk.chunk.replace('[Function Call]:', '').trim();
        process.stdout.write('*'); // Show function call progress
      } else {
        // This is a regular text chunk
        fullText += chunk.chunk;
        process.stdout.write(chunk.chunk);
      }
      
      if (chunk.done) {
        console.log('\n\nStream finished.');
        console.log('Finish reason:', chunk.finishReason);
        break;
      }
    }
    
    console.log('\nFull text:', fullText);
    
    if (functionCallData) {
      console.log('Function call data:', functionCallData);
      
      try {
        // Parse the function call data
        const functionCall = JSON.parse(functionCallData);
        console.log('Parsed function call:', functionCall);
      } catch (error) {
        console.error('Error parsing function call data:', error);
      }
    }
  } catch (error) {
    console.error('Error in streaming with function calls:', error);
  }
}
```

### Combining Multiple Features

You can combine multiple features for complex interactions:

```typescript
async function complexExample() {
  try {
    // Define tools
    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_database',
          description: 'Search a database for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
              },
            },
            required: ['query'],
          },
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_current_time',
          description: 'Get the current time in a specific timezone',
          parameters: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'The timezone (e.g., "America/New_York")',
              },
            },
            required: ['timezone'],
          },
        }
      }
    ];
    
    // Start a conversation
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant with access to tools for searching a database and getting the current time.'
      },
      {
        role: 'user',
        content: 'I need information about renewable energy and also what time it is in Tokyo.'
      }
    ];
    
    // First response with tool calls
    const response1 = await adapter.generateCompletion('', {
      messages,
      tools,
      toolChoice: 'auto',
      temperature: 0.2,
      maxRetries: 2
    });
    
    console.log('Initial response:', response1.text);
    console.log('Tool calls:', response1.toolCalls);
    
    // Handle tool calls
    const toolResponses = [];
    
    if (response1.toolCalls && response1.toolCalls.length > 0) {
      for (const toolCall of response1.toolCalls) {
        if (toolCall.type === 'function') {
          const { name, arguments: args } = toolCall.function;
          const parsedArgs = JSON.parse(args);
          
          if (name === 'search_database') {
            // Simulate database search
            toolResponses.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                results: [
                  { title: 'Solar Energy Basics', source: 'database' },
                  { title: 'Wind Power Technologies', source: 'database' },
                  { title: 'Hydroelectric Power', source: 'database' }
                ]
              })
            });
          } else if (name === 'get_current_time') {
            // Simulate getting current time
            toolResponses.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                time: '14:30',
                timezone: parsedArgs.timezone,
                date: '2025-04-23'
              })
            });
          }
        }
      }
    }
    
    // Continue conversation with tool results
    const updatedMessages = [
      ...response1.messages || [],
      ...toolResponses
    ];
    
    // Stream the final response
    console.log('\nStreaming final response:');
    
    const stream = adapter.generateCompletionStream('', {
      messages: updatedMessages,
      temperature: 0.7,
      maxTokens: 500
    });
    
    for await (const chunk of stream) {
      if (chunk.error) {
        console.error('Stream error:', chunk.errorDetails);
        break;
      }
      
      process.stdout.write(chunk.chunk);
      
      if (chunk.done) {
        console.log('\n\nStream finished.');
        break;
      }
    }
  } catch (error) {
    console.error('Error in complex example:', error);
  }
}
```

## Configuration

The LMStudio adapter can be configured through multiple methods:

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

### Direct Parameter Passing

You can also configure the adapter by passing parameters directly to the constructor or method calls:

```typescript
// Configure timeout in the request options
const response = await adapter.generateCompletion('Hello', {
  timeoutMs: 30000,
  maxRetries: 2,
  initialBackoff: 500
});
```

### Default Values

The adapter uses these default values if not otherwise specified:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `baseUrl` | `http://localhost:1234/v1` | LMStudio API base URL |
| `timeout` | `60000` (60 seconds) | Request timeout in milliseconds |
| `maxRetries` | `3` (non-streaming), `2` (streaming) | Maximum number of retry attempts |
| `initialBackoff` | `1000` (1 second) | Initial backoff time for retries in milliseconds |
| `temperature` | `0.7` | Temperature parameter for generation |
| `maxTokens` | `1024` | Maximum number of tokens to generate |
| `topP` | `1` | Top-p sampling parameter |
| `frequencyPenalty` | `0` | Frequency penalty parameter |
| `presencePenalty` | `0` | Presence penalty parameter |
| `systemMessage` | `"You are a helpful assistant."` | Default system message |

## Migration Guide

If you're migrating from the previous version of the LMStudio adapter to the enhanced version, here's what you need to know:

### Backward Compatibility

The enhanced adapter maintains full backward compatibility with the previous version. Existing code that uses the adapter will continue to work without modifications.

### Migrating to New Features

To take advantage of the new features:

#### From Basic Completion to Conversation History

**Before:**
```typescript
const response = await adapter.generateCompletion(
  'What is the capital of France?',
  { temperature: 0.7 }
);
console.log(response.text);
```

**After:**
```typescript
// First message
const response1 = await adapter.generateCompletion(
  'What is the capital of France?',
  { temperature: 0.7 }
);
console.log(response1.text);

// Continue the conversation
const messages = [
  ...(response1.messages || []),
  {
    role: 'user',
    content: 'What is its population?'
  }
];

const response2 = await adapter.generateCompletion('', { messages });
console.log(response2.text);
```

#### Adding Function Calling

**Before:**
```typescript
const response = await adapter.generateCompletion(
  'What is the weather in New York?',
  { temperature: 0.7 }
);
console.log(response.text);
```

**After:**
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
  'What is the weather in New York?',
  {
    functions,
    functionCall: 'auto',
    temperature: 0.7
  }
);

if (response.functionCall) {
  // Handle function call
  console.log('Function call:', response.functionCall);
} else {
  console.log(response.text);
}
```

#### Migrating from Non-Streaming to Streaming

**Before:**
```typescript
const response = await adapter.generateCompletion(
  'Tell me a story about a space explorer.',
  { temperature: 0.7 }
);
console.log(response.text);
```

**After:**
```typescript
const stream = adapter.generateCompletionStream(
  'Tell me a story about a space explorer.',
  { temperature: 0.7 }
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

## Best Practices

### Error Handling

Always implement proper error handling when using the adapter:

```typescript
try {
  const response = await adapter.generateCompletion('Hello', {
    maxRetries: 3,
    initialBackoff: 1000
  });
  console.log(response.text);
} catch (error) {
  if (error.code === 'MODEL_RATE_LIMITED') {
    console.log('Rate limited, try again later');
  } else if (error.code === 'MODEL_CONTEXT_LENGTH') {
    console.log('Input is too long for the model');
  } else if (error.code === 'MODEL_UNAVAILABLE') {
    console.log('Model is currently unavailable');
  } else {
    console.error('Error:', error.message);
  }
}
```

### Optimizing Performance

To optimize performance:

1. **Use Streaming for Long Responses**: Streaming reduces perceived latency for users.
2. **Set Appropriate Timeouts**: Adjust timeouts based on your use case and model size.
3. **Limit Context Size**: Keep conversation history concise to avoid hitting context limits.
4. **Use Appropriate Temperature**: Lower temperature for more deterministic responses, higher for more creative ones.
5. **Implement Caching**: Cache common responses to reduce API calls.

### Security Considerations

When using the LMStudio adapter:

1. **Validate User Input**: Always validate and sanitize user input before sending it to the model.
2. **Limit Function Capabilities**: When defining functions or tools, limit their capabilities to prevent misuse.
3. **Monitor Usage**: Implement monitoring to detect unusual patterns or potential abuse.
4. **Handle Sensitive Information**: Be careful with sensitive information in prompts or responses.

### Monitoring and Logging

Implement proper monitoring and logging:

1. **Log Request/Response Metrics**: Track token usage, response times, and error rates.
2. **Monitor Circuit Breaker Events**: Track when the circuit breaker opens or closes.
3. **Set Up Alerts**: Create alerts for high error rates or circuit breaker events.
4. **Implement Distributed Tracing**: Use distributed tracing to track requests across services.

## Troubleshooting

### Common Issues and Solutions

#### LMStudio API Not Available

**Symptoms**: Requests fail with connection errors or timeout errors.

**Solutions**:
1. Ensure LMStudio is running with the API server enabled.
2. Check the URL and port configuration.
3. Verify network connectivity between your application and LMStudio.

#### Model Not Loaded

**Symptoms**: Requests fail with "model not found" errors.

**Solutions**:
1. Verify the model is loaded in LMStudio.
2. Check that the model ID in your code matches the one in LMStudio.
3. Try reloading the model in LMStudio.

#### Function Calling Not Working

**Symptoms**: The model doesn't use the provided functions or returns invalid function calls.

**Solutions**:
1. Verify the model supports function calling (e.g., Llama 3, Mistral, Claude models).
2. Check function definitions for proper formatting.
3. Try simplifying the function definitions.
4. Adjust the system message to explicitly instruct the model to use functions.

#### Circuit Breaker Open

**Symptoms**: Requests fail immediately with "circuit breaker open" errors.

**Solutions**:
1. Wait for the circuit breaker to reset (typically 30 seconds).
2. Check logs to identify the root cause of the failures.
3. Address any underlying issues with LMStudio or the model.

#### High Latency

**Symptoms**: Requests take a long time to complete.

**Solutions**:
1. Use streaming for long responses.
2. Reduce the context size by limiting conversation history.
3. Use a smaller or more efficient model.
4. Ensure your machine has sufficient resources for the model.

## Conclusion

The enhanced LMStudio adapter provides a robust and feature-rich integration with LMStudio's local API server. With support for conversation history, function calling, tool usage, error handling, and streaming, it offers capabilities comparable to cloud-based LLM services while allowing you to run models locally.

By following the guidelines and best practices in this documentation, you can effectively leverage the enhanced adapter to build powerful AI applications with LMStudio.