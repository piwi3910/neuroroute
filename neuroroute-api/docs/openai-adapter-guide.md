# OpenAI Adapter Documentation

## Overview

The enhanced OpenAI adapter provides a robust interface for interacting with OpenAI's Chat Completions API. This adapter extends the base model adapter functionality with support for advanced features including system messages, conversation history, function calling, and tool usage. The implementation maintains backward compatibility while providing a more flexible and powerful interface for developers.

## Key Features

- **System Messages**: Control the assistant's behavior with system messages
- **Conversation History**: Support for multi-turn conversations with full message history
- **Function Calling**: Define functions that the model can call when appropriate
- **Tool Usage**: Define tools that the model can use to perform actions
- **Backward Compatibility**: Maintains compatibility with existing code
- **Error Handling**: Robust error handling with retries for transient errors
- **Circuit Breaker Pattern**: Prevents cascading failures during API outages

## API Reference

### Message Types

The adapter supports various message types for conversation history:

```typescript
// Base message interface
export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  name?: string;
}

// Message role type
export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool';

// System message
export interface SystemMessage extends ChatMessage {
  role: 'system';
  content: string;
}

// User message
export interface UserMessage extends ChatMessage {
  role: 'user';
  content: string;
}

// Assistant message
export interface AssistantMessage extends ChatMessage {
  role: 'assistant';
  content: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}

// Function message
export interface FunctionMessage extends ChatMessage {
  role: 'function';
  content: string;
  name: string;
}

// Tool message
export interface ToolMessage extends ChatMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}
```

### Function and Tool Types

The adapter supports function calling and tool usage with these types:

```typescript
// Function definition
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

// Function call
export interface FunctionCall {
  name: string;
  arguments: string;
}

// Tool definition
export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

// Tool call
export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}
```

### Request Options

The adapter extends the base model request options with OpenAI-specific options:

```typescript
// OpenAI-specific request options
export interface OpenAIRequestOptions extends ModelRequestOptions {
  // Existing options inherited from ModelRequestOptions
  
  // New options
  messages?: ChatMessage[];    // Full message history
  systemMessage?: string;      // Shorthand for system message
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}
```

### Response Types

The adapter returns enhanced model responses that include function calls, tool calls, and conversation history:

```typescript
// Model response interface
export interface ModelResponse {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  processingTime: number;
  raw?: RawProviderResponse;   // Raw response from the provider
  functionCall?: FunctionCall;
  toolCalls?: ToolCall[];
  messages?: ChatMessage[];    // Full conversation history
}
```

## Usage Examples

### Basic Usage

The most basic usage pattern remains unchanged for backward compatibility:

```typescript
import createOpenAIAdapter from '../src/models/openai-adapter.js';

// Create the adapter
const adapter = createOpenAIAdapter(fastify, 'gpt-4');

// Generate a completion
const response = await adapter.generateCompletion(
  'What is the capital of France?',
  { temperature: 0.7 }
);

console.log(response.text);
```

### Using System Messages

System messages allow you to control the assistant's behavior:

```typescript
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';

// Create the adapter
const adapter = createOpenAIAdapter(fastify, 'gpt-4');

// Generate a completion with a system message
const response = await adapter.generateCompletion(
  'What is the capital of France?',
  {
    systemMessage: 'You are a helpful geography teacher. Keep answers brief and educational.',
    temperature: 0.7
  } as OpenAIRequestOptions
);

console.log(response.text);
```

### Using Conversation History

You can maintain a conversation across multiple turns:

```typescript
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';
import { ChatMessage } from '../src/models/base-adapter.js';

// Create the adapter
const adapter = createOpenAIAdapter(fastify, 'gpt-4');

// Define a conversation history
const messages: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello, how are you?' },
  { role: 'assistant', content: 'I\'m doing well, thank you for asking! How can I help you today?' },
  { role: 'user', content: 'Tell me about the solar system.' }
];

// Generate a completion with conversation history
const response = await adapter.generateCompletion(
  '', // Empty prompt since we're using messages
  {
    messages: messages,
    temperature: 0.7
  } as OpenAIRequestOptions
);

console.log(response.text);

// The response includes the updated conversation history
console.log('Updated conversation history:');
response.messages?.forEach((message, index) => {
  console.log(`[${index + 1}] ${message.role}: ${message.content?.substring(0, 50)}...`);
});

// For the next turn, you can use the updated conversation history
const nextResponse = await adapter.generateCompletion(
  '', // Empty prompt since we're using messages
  {
    messages: response.messages,
    temperature: 0.7
  } as OpenAIRequestOptions
);
```

### Using Function Calling

Function calling allows the model to call functions when appropriate:

```typescript
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';
import { FunctionDefinition } from '../src/models/base-adapter.js';

// Create the adapter
const adapter = createOpenAIAdapter(fastify, 'gpt-4');

// Define a function
const functions: FunctionDefinition[] = [
  {
    name: 'get_weather',
    description: 'Get the current weather in a given location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA'
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'The temperature unit to use'
        }
      },
      required: ['location']
    }
  }
];

// Generate a completion with function calling
const response = await adapter.generateCompletion(
  'What\'s the weather like in New York?',
  {
    functions: functions,
    functionCall: 'auto',
    temperature: 0.2
  } as OpenAIRequestOptions
);

if (response.functionCall) {
  console.log('Function call detected:');
  console.log('Function name:', response.functionCall.name);
  console.log('Arguments:', response.functionCall.arguments);
  
  // In a real application, you would call the actual function here
  // and then continue the conversation with the function result
  
  // Example of continuing the conversation with the function result
  const functionResult = JSON.stringify({
    location: 'New York',
    temperature: 72,
    unit: 'fahrenheit',
    condition: 'sunny'
  });
  
  // Continue the conversation with the function result
  const followUpMessages = [
    ...(response.messages || []),
    {
      role: 'function',
      name: response.functionCall.name,
      content: functionResult
    }
  ];
  
  const followUpResponse = await adapter.generateCompletion(
    '',
    {
      messages: followUpMessages,
      temperature: 0.7
    } as OpenAIRequestOptions
  );
  
  console.log('Follow-up response:', followUpResponse.text);
}
```

### Using Tool Usage

Tool usage is similar to function calling but uses the newer tools API:

```typescript
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';
import { ToolDefinition } from '../src/models/base-adapter.js';

// Create the adapter
const adapter = createOpenAIAdapter(fastify, 'gpt-4');

// Define tools (similar to functions but with the new tools API format)
const tools: ToolDefinition[] = [
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
            description: 'The city and state, e.g. San Francisco, CA'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The temperature unit to use'
          }
        },
        required: ['location']
      }
    }
  }
];

// Generate a completion with tool usage
const response = await adapter.generateCompletion(
  'What\'s the weather like in Tokyo?',
  {
    tools: tools,
    toolChoice: 'auto',
    temperature: 0.2
  } as OpenAIRequestOptions
);

if (response.toolCalls && response.toolCalls.length > 0) {
  console.log('Tool calls detected:');
  
  for (const toolCall of response.toolCalls) {
    console.log('Tool call ID:', toolCall.id);
    console.log('Tool type:', toolCall.type);
    console.log('Function name:', toolCall.function.name);
    console.log('Arguments:', toolCall.function.arguments);
    
    // In a real application, you would call the actual function here
    // and then continue the conversation with the tool result
  }
  
  // Example of continuing the conversation with the tool result
  const toolResult = JSON.stringify({
    location: 'Tokyo',
    temperature: 22,
    unit: 'celsius',
    condition: 'partly cloudy'
  });
  
  // Continue the conversation with the tool result
  const followUpMessages = [
    ...(response.messages || []),
    {
      role: 'tool',
      tool_call_id: response.toolCalls[0].id,
      content: toolResult
    }
  ];
  
  const followUpResponse = await adapter.generateCompletion(
    '',
    {
      messages: followUpMessages,
      temperature: 0.7
    } as OpenAIRequestOptions
  );
  
  console.log('Follow-up response:', followUpResponse.text);
}
```

### Combining Multiple Features

You can combine multiple features in a single request:

```typescript
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';
import { ChatMessage, ToolDefinition } from '../src/models/base-adapter.js';

// Create the adapter
const adapter = createOpenAIAdapter(fastify, 'gpt-4');

// Define conversation history
const messages: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful weather assistant.' },
  { role: 'user', content: 'I\'m planning a trip.' },
  { role: 'assistant', content: 'That sounds exciting! Where are you planning to go?' },
  { role: 'user', content: 'I\'m thinking about visiting Tokyo next week.' }
];

// Define tools
const tools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather_forecast',
      description: 'Get the weather forecast for a location and date range',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and country'
          },
          start_date: {
            type: 'string',
            description: 'The start date in YYYY-MM-DD format'
          },
          end_date: {
            type: 'string',
            description: 'The end date in YYYY-MM-DD format'
          }
        },
        required: ['location', 'start_date', 'end_date']
      }
    }
  }
];

// Generate a completion with multiple features
const response = await adapter.generateCompletion(
  'What will the weather be like during my trip?',
  {
    messages: messages,
    tools: tools,
    toolChoice: 'auto',
    temperature: 0.7
  } as OpenAIRequestOptions
);

console.log(response.text);

// Handle tool calls if present
if (response.toolCalls && response.toolCalls.length > 0) {
  // Process tool calls...
}
```

## Migration Guide

### Migrating from the Original Adapter

The enhanced OpenAI adapter maintains backward compatibility with the original adapter, so existing code should continue to work without modifications. However, to take advantage of the new features, you'll need to make some changes:

#### Original Usage

```typescript
import createOpenAIAdapter from '../src/models/openai-adapter.js';

const adapter = createOpenAIAdapter(fastify, 'gpt-4');

const response = await adapter.generateCompletion(
  'What is the capital of France?',
  { temperature: 0.7 }
);

console.log(response.text);
```

#### Enhanced Usage

```typescript
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';

const adapter = createOpenAIAdapter(fastify, 'gpt-4');

const response = await adapter.generateCompletion(
  'What is the capital of France?',
  {
    systemMessage: 'You are a helpful geography teacher.',
    temperature: 0.7
  } as OpenAIRequestOptions
);

console.log(response.text);
```

### Key Changes

1. **Import the OpenAIRequestOptions type**: To use the new features, you'll need to import the OpenAIRequestOptions type.
2. **Cast options to OpenAIRequestOptions**: When using the new options, cast the options object to OpenAIRequestOptions.
3. **Use the new options**: Add the new options (systemMessage, messages, functions, tools, etc.) to the options object.
4. **Handle function and tool calls**: Check for function calls and tool calls in the response and handle them appropriately.

## Best Practices

### System Messages

- Use system messages to set the tone, personality, and behavior of the assistant.
- Keep system messages concise and focused on the desired behavior.
- System messages are most effective when they provide clear instructions about the assistant's role and constraints.

```typescript
// Good system message
systemMessage: 'You are a helpful customer service representative for a tech company. Be polite, concise, and focus on solving the customer\'s problem.'

// Less effective system message
systemMessage: 'Be helpful.'
```

### Conversation History

- Include the full conversation history for multi-turn conversations to maintain context.
- Limit the conversation history to a reasonable length to avoid exceeding token limits.
- Consider summarizing or truncating older messages if the conversation gets too long.

```typescript
// If the conversation gets too long, consider summarizing older messages
if (messages.length > 10) {
  messages = [
    messages[0], // Keep the system message
    {
      role: 'system',
      content: 'The conversation so far has covered: [summary of previous messages]'
    },
    ...messages.slice(-5) // Keep the 5 most recent messages
  ];
}
```

### Function Calling

- Define functions with clear names, descriptions, and parameter schemas.
- Use the 'auto' function call mode to let the model decide when to call functions.
- Specify a particular function name when you want to force the model to call a specific function.
- Always validate function arguments before executing functions.

```typescript
// Validate function arguments
if (response.functionCall?.name === 'get_weather') {
  try {
    const args = JSON.parse(response.functionCall.arguments);
    if (!args.location) {
      throw new Error('Missing required parameter: location');
    }
    // Proceed with function execution
  } catch (error) {
    console.error('Invalid function arguments:', error);
    // Handle the error appropriately
  }
}
```

### Tool Usage

- Define tools with clear names, descriptions, and parameter schemas.
- Use the 'auto' tool choice mode to let the model decide when to use tools.
- Handle multiple tool calls when they occur.
- Always validate tool arguments before executing tool functions.

```typescript
// Handle multiple tool calls
if (response.toolCalls && response.toolCalls.length > 0) {
  const toolResults = [];
  
  for (const toolCall of response.toolCalls) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      // Validate args and execute the tool function
      const result = await executeToolFunction(toolCall.function.name, args);
      
      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    } catch (error) {
      console.error(`Error executing tool ${toolCall.function.name}:`, error);
      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error: error.message })
      });
    }
  }
  
  // Continue the conversation with all tool results
  const followUpMessages = [
    ...(response.messages || []),
    ...toolResults
  ];
  
  const followUpResponse = await adapter.generateCompletion(
    '',
    {
      messages: followUpMessages,
      temperature: 0.7
    } as OpenAIRequestOptions
  );
}
```

### Error Handling

- Implement proper error handling for API errors.
- Use try-catch blocks to catch and handle errors.
- Provide meaningful error messages to users.
- Consider implementing fallback options for when the API is unavailable.

```typescript
try {
  const response = await adapter.generateCompletion(prompt, options);
  // Process the response
} catch (error) {
  console.error('Error generating completion:', error);
  
  if (error.code === 'MODEL_AUTHENTICATION') {
    // Handle authentication errors
  } else if (error.code === 'MODEL_QUOTA_EXCEEDED') {
    // Handle quota exceeded errors
  } else if (error.code === 'MODEL_CONTENT_FILTERED') {
    // Handle content filter errors
  } else {
    // Handle other errors
  }
}
```

### Performance Optimization

- Use streaming for long responses to improve user experience.
- Set appropriate timeout values based on your application's requirements.
- Implement caching for common requests to reduce API calls.
- Monitor token usage to optimize costs.

```typescript
// Use streaming for long responses
const stream = adapter.generateCompletionStream(prompt, options);

for await (const chunk of stream) {
  // Process each chunk as it arrives
  process.stdout.write(chunk.chunk);
  
  if (chunk.done) {
    console.log('\nStream complete');
  }
}
```

## Conclusion

The enhanced OpenAI adapter provides a powerful and flexible interface for interacting with OpenAI's Chat Completions API. With support for system messages, conversation history, function calling, and tool usage, developers can build more sophisticated applications that leverage the full capabilities of OpenAI's models.

By following the best practices outlined in this documentation, developers can create robust, efficient, and user-friendly applications that provide a great experience for users while optimizing for performance and cost.