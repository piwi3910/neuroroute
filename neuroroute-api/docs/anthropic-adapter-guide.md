# Anthropic Adapter Documentation

## Overview

The enhanced Anthropic adapter provides a robust interface to Anthropic's Claude API, fully supporting the latest features of the Claude 3 family of models. This adapter serves as a bridge between your application and Anthropic's powerful language models, offering a consistent interface while exposing the advanced capabilities of Claude.

The adapter has been significantly enhanced to support:

- System messages for controlling assistant behavior
- Conversation history for multi-turn interactions
- Tool usage for function calling capabilities
- Extended thinking for showing model reasoning
- Enhanced streaming with improved error handling
- Robust error handling with retries and circuit breaker patterns

This document provides a comprehensive guide to using the enhanced Anthropic adapter, including API reference, usage examples, migration guidance, and best practices.

## New Features

### System Messages

System messages allow you to set the behavior, personality, or role of the assistant. They provide high-level instructions that guide the model's responses throughout the conversation.

```typescript
const response = await adapter.generateCompletion(
  "What is your role?",
  {
    systemMessage: "You are a helpful AI assistant that specializes in explaining complex technical concepts in simple terms."
  } as AnthropicRequestOptions
);
```

### Conversation History

The adapter now fully supports multi-turn conversations with message history. You can provide a complete conversation history to maintain context across multiple interactions.

```typescript
const response = await adapter.generateCompletion(
  "What did I just ask you to explain?",
  {
    messages: [
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "user", content: "Explain quantum computing in simple terms." },
      { role: "assistant", content: "Quantum computing uses quantum bits or qubits, which can exist in multiple states at once, unlike classical bits that are either 0 or 1. This allows quantum computers to process certain types of problems much faster than classical computers." },
      { role: "user", content: "What did I just ask you to explain?" }
    ]
  } as AnthropicRequestOptions
);
```

### Tool Usage

The adapter supports Claude's tool usage capabilities, allowing the model to call functions defined by your application. This enables the model to request specific information or perform actions that it cannot do directly.

```typescript
// Define a weather tool
const weatherTool: ToolDefinition = {
  type: "function",
  function: {
    name: "get_weather",
    description: "Get the current weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and state, e.g., San Francisco, CA",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "The unit of temperature",
        },
      },
      required: ["location"],
    },
  },
};

// Request with tool
const response = await adapter.generateCompletion(
  "What's the weather like in San Francisco?",
  {
    tools: [weatherTool],
    toolChoice: "auto"
  } as AnthropicRequestOptions
);

// Check for tool calls
if (response.toolCalls) {
  // Process tool calls
  const toolResults = await Promise.all(
    response.toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);
      // Call your actual function with the arguments
      const result = await yourActualFunction(args);
      return {
        role: "tool",
        content: JSON.stringify(result),
        tool_call_id: toolCall.id
      };
    })
  );
  
  // Continue the conversation with tool results
  const continuationResponse = await adapter.generateCompletion(
    "",
    {
      messages: [...response.messages, ...toolResults]
    } as AnthropicRequestOptions
  );
}
```

### Extended Thinking

Claude can now show its reasoning process through the "thinking" capability. This allows the model to work through complex problems step by step, making its thought process transparent.

```typescript
const response = await adapter.generateCompletion(
  "Solve this step by step: If a train travels at 60 mph for 2 hours, then at 30 mph for 1 hour, what is the average speed for the entire journey?",
  {
    thinking: {
      type: "enabled",
      budget_tokens: 500
    }
  } as AnthropicRequestOptions
);

// Access the thinking content
const rawResponse = response.raw as any;
if (rawResponse.thinking) {
  console.log("Extended Thinking:", rawResponse.thinking);
}
```

### Enhanced Streaming

The adapter provides improved streaming support, allowing you to receive the model's response in real-time as it's being generated.

```typescript
const stream = adapter.generateCompletionStream(
  "Write a short poem about AI",
  {
    systemMessage: "You are a creative AI poet that writes in the style of Shakespeare."
  } as AnthropicRequestOptions
);

for await (const chunk of stream) {
  if (!chunk.done) {
    process.stdout.write(chunk.chunk);
  }
}
```

### Error Handling and Retries

The adapter includes robust error handling with automatic retries for transient errors, using exponential backoff with jitter. It also implements a circuit breaker pattern to prevent cascading failures.

```typescript
const response = await adapter.generateCompletion(
  "Test prompt",
  {
    maxRetries: 3,        // Maximum number of retries
    initialBackoff: 1000  // Initial backoff in milliseconds
  } as AnthropicRequestOptions
);
```

## API Reference

### Message Types

```typescript
// Base message interface
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}
```

### Tool Types

```typescript
// Tool definition
interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// Tool call
interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Function call (for backward compatibility)
interface FunctionCall {
  name: string;
  arguments: string;
}
```

### Request Options

```typescript
// Anthropic-specific request options
interface AnthropicRequestOptions extends ModelRequestOptions {
  // Existing options inherited from ModelRequestOptions
  
  // New options
  messages?: ChatMessage[];    // Full message history
  systemMessage?: string;      // Shorthand for system message
  tools?: ToolDefinition[];    // Tools that Claude can use
  toolChoice?: 'auto' | 'any' | 'none' | { type: 'function'; function: { name: string } };
  thinking?: {                 // Extended thinking configuration
    type: 'enabled';
    budget_tokens: number;
  };
}
```

### Response Types

```typescript
// Anthropic API response interface
interface AnthropicResponse {
  id: string;
  type: string;
  model: string;
  role: string;
  content: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
    thinking?: string;
    signature?: string;
  }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string | null;
  stop_sequence: string | null;
  [key: string]: unknown; // Index signature for additional properties
}

// Model response (returned by the adapter)
interface ModelResponse {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  processingTime: number;
  raw?: any;
  functionCall?: FunctionCall;
  toolCalls?: ToolCall[];
  messages?: ChatMessage[];
}
```

### Streaming Event Types

```typescript
// Base streaming event
interface AnthropicStreamEvent {
  type: string;
  [key: string]: any;
}

// Message start event
interface MessageStartEvent extends AnthropicStreamEvent {
  type: 'message_start';
  message: AnthropicResponse;
}

// Content block start event
interface ContentBlockStartEvent extends AnthropicStreamEvent {
  type: 'content_block_start';
  index: number;
  content_block: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
  };
}

// Content block delta event
interface ContentBlockDeltaEvent extends AnthropicStreamEvent {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta' | 'input_json_delta' | 'thinking_delta' | 'signature_delta';
    text?: string;
    thinking?: string;
    signature?: string;
    partial_json?: string;
  };
}

// Content block stop event
interface ContentBlockStopEvent extends AnthropicStreamEvent {
  type: 'content_block_stop';
  index: number;
}

// Message delta event
interface MessageDeltaEvent extends AnthropicStreamEvent {
  type: 'message_delta';
  delta: {
    stop_reason?: string;
    stop_sequence?: string | null;
  };
  usage?: {
    output_tokens: number;
  };
}

// Message stop event
interface MessageStopEvent extends AnthropicStreamEvent {
  type: 'message_stop';
}

// Streaming chunk (returned by the adapter)
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

### Using System Messages

System messages provide high-level instructions to the model about its behavior, role, or personality.

```typescript
import { AnthropicAdapter, AnthropicRequestOptions } from '../src/models/anthropic-adapter.js';

// Create Anthropic adapter
const adapter = new AnthropicAdapter(app, 'claude-3-sonnet');

// Example: Using system message
const systemMessageResponse = await adapter.generateCompletion(
  'What is your role?',
  {
    systemMessage: 'You are a helpful AI assistant that specializes in explaining complex technical concepts in simple terms.',
    maxTokens: 100,
  } as AnthropicRequestOptions
);

console.log(`Response: ${systemMessageResponse.text}`);
// Output: "I am an AI assistant that specializes in explaining complex technical concepts in simple terms..."
```

### Using Conversation History

Maintain context across multiple turns of conversation by providing the full message history.

```typescript
// Example: Using conversation history
const conversationHistoryResponse = await adapter.generateCompletion(
  'What did I just ask you to explain?',
  {
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant.' },
      { role: 'user', content: 'Explain quantum computing in simple terms.' },
      { role: 'assistant', content: 'Quantum computing uses quantum bits or qubits, which can exist in multiple states at once, unlike classical bits that are either 0 or 1. This allows quantum computers to process certain types of problems much faster than classical computers.' },
      { role: 'user', content: 'What did I just ask you to explain?' },
    ],
    maxTokens: 100,
  } as AnthropicRequestOptions
);

console.log(`Response: ${conversationHistoryResponse.text}`);
// Output: "You asked me to explain quantum computing in simple terms."
```

### Using Tool Usage

Enable Claude to call functions defined by your application to access external information or perform actions.

```typescript
// Define a weather tool
const weatherTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g., San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'The unit of temperature',
        },
      },
      required: ['location'],
    },
  },
};

// Example: Using tool usage
const toolUsageResponse = await adapter.generateCompletion(
  'What\'s the weather like in San Francisco?',
  {
    tools: [weatherTool],
    toolChoice: 'auto',
    maxTokens: 200,
  } as AnthropicRequestOptions
);

// Check for tool calls
if (toolUsageResponse.toolCalls) {
  console.log('Tool Calls:');
  toolUsageResponse.toolCalls.forEach(toolCall => {
    console.log(`- Tool: ${toolCall.function.name}`);
    console.log(`  Arguments: ${toolCall.function.arguments}`);
    
    // In a real application, you would call your actual function here
    const args = JSON.parse(toolCall.function.arguments);
    const result = getWeather(args.location, args.unit);
    
    // Continue the conversation with the tool result
    const toolResult = JSON.stringify(result);
    const toolMessages = [
      ...toolUsageResponse.messages,
      {
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id
      }
    ];
    
    // Get the final response
    const finalResponse = await adapter.generateCompletion('', {
      messages: toolMessages
    } as AnthropicRequestOptions);
    
    console.log(`Final response: ${finalResponse.text}`);
  });
}
```

### Using Extended Thinking

Access Claude's reasoning process for complex problems.

```typescript
// Example: Using extended thinking
const extendedThinkingResponse = await adapter.generateCompletion(
  'Solve this step by step: If a train travels at 60 mph for 2 hours, then at 30 mph for 1 hour, what is the average speed for the entire journey?',
  {
    thinking: {
      type: 'enabled',
      budget_tokens: 500,
    },
    maxTokens: 200,
  } as AnthropicRequestOptions
);

console.log(`Response: ${extendedThinkingResponse.text}`);

// Show thinking if available
const rawResponse = extendedThinkingResponse.raw as any;
if (rawResponse.thinking) {
  console.log('\nExtended Thinking:');
  console.log(rawResponse.thinking);
}
```

### Using Streaming

Receive the model's response in real-time as it's being generated.

```typescript
// Example: Streaming with system message
console.log('Streaming response:');

const stream = adapter.generateCompletionStream(
  'Write a short poem about AI',
  {
    systemMessage: 'You are a creative AI poet that writes in the style of Shakespeare.',
    maxTokens: 150,
  } as AnthropicRequestOptions
);

for await (const chunk of stream) {
  if (!chunk.done) {
    process.stdout.write(chunk.chunk);
  }
}
```

### Combining Multiple Features

You can combine multiple features for more complex use cases.

```typescript
// Example: Combining system message, tool usage, and streaming
const stream = adapter.generateCompletionStream(
  'What\'s the weather like in San Francisco and what should I wear?',
  {
    systemMessage: 'You are a helpful weather assistant.',
    tools: [weatherTool],
    toolChoice: 'auto',
    maxTokens: 200,
  } as AnthropicRequestOptions
);

// Process the streaming response
const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
  if (!chunk.done) {
    process.stdout.write(chunk.chunk);
  }
}

// Check for tool calls in the final response
const finalChunk = chunks[chunks.length - 1];
if (finalChunk.toolCalls) {
  // Process tool calls as in the previous example
}
```

## Migration Guide

### Migrating from the Old Adapter

The enhanced Anthropic adapter maintains backward compatibility with the old adapter, so existing code should continue to work without modifications. However, to take advantage of the new features, you'll need to make some changes.

#### Before (Old Adapter)

```typescript
const response = await adapter.generateCompletion(
  "Tell me about quantum computing",
  {
    maxTokens: 100,
    temperature: 0.7
  }
);

console.log(response.text);
```

#### After (Enhanced Adapter)

```typescript
// Using system message
const response = await adapter.generateCompletion(
  "Tell me about quantum computing",
  {
    systemMessage: "You are a helpful AI assistant that specializes in explaining complex technical concepts in simple terms.",
    maxTokens: 100,
    temperature: 0.7
  } as AnthropicRequestOptions
);

console.log(response.text);
```

### Key Changes

1. **Import the AnthropicRequestOptions interface**:
   ```typescript
   import { AnthropicAdapter, AnthropicRequestOptions } from '../models/anthropic-adapter.js';
   ```

2. **Use type assertion for request options**:
   ```typescript
   // Use type assertion to access new options
   const options = {
     // New options
     systemMessage: "...",
     messages: [...],
     tools: [...],
     toolChoice: "auto",
     thinking: { type: "enabled", budget_tokens: 500 },
     
     // Existing options still work
     maxTokens: 100,
     temperature: 0.7
   } as AnthropicRequestOptions;
   ```

3. **Access new response properties**:
   ```typescript
   // Check for tool calls
   if (response.toolCalls) {
     // Process tool calls
   }
   
   // Access thinking content
   const rawResponse = response.raw as any;
   if (rawResponse.thinking) {
     console.log(rawResponse.thinking);
   }
   
   // Use conversation history
   const messages = response.messages;
   ```

## Best Practices

### System Messages

1. **Be specific and clear**: Provide clear instructions about the assistant's role, tone, and behavior.
2. **Keep it concise**: System messages should be concise but comprehensive.
3. **Use for persistent instructions**: System messages apply to the entire conversation, so use them for instructions that should persist across turns.

```typescript
// Good system message
systemMessage: "You are a technical support specialist for our cloud platform. Provide accurate, concise answers. When you don't know something, admit it clearly. Use a friendly, professional tone."

// Too vague
systemMessage: "Be helpful."
```

### Conversation History

1. **Maintain the full history**: Always pass the complete conversation history to maintain context.
2. **Limit history when necessary**: If the conversation gets too long, consider summarizing earlier turns or removing less relevant messages.
3. **Include system message**: If using the `messages` array, include the system message as the first message with `role: 'system'`.

```typescript
// Maintain conversation history
const response1 = await adapter.generateCompletion("Hello", options);
const response2 = await adapter.generateCompletion("What did I just say?", {
  ...options,
  messages: response1.messages
});
```

### Tool Usage

1. **Define tools clearly**: Provide clear names, descriptions, and parameter schemas for your tools.
2. **Handle tool calls properly**: Always check for tool calls in the response and process them appropriately.
3. **Continue the conversation**: After processing tool calls, continue the conversation by passing the tool results back to the model.
4. **Use appropriate tool choice**: Set `toolChoice` to control when tools are used:
   - `'auto'`: Let Claude decide when to use tools
   - `'any'`: Encourage Claude to use tools
   - `'none'`: Prevent Claude from using tools
   - `{ type: 'function', function: { name: 'tool_name' } }`: Force Claude to use a specific tool

```typescript
// Define tool with clear description and parameters
const calculatorTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Perform a mathematical calculation',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate, e.g., "2 + 2"',
        }
      },
      required: ['expression'],
    },
  },
};
```

### Extended Thinking

1. **Use for complex problems**: Enable thinking for complex reasoning tasks, math problems, or step-by-step analyses.
2. **Set appropriate token budget**: Allocate enough tokens for the thinking process based on the complexity of the problem.
3. **Preserve thinking in logs**: Consider logging the thinking content for debugging or auditing purposes.

```typescript
// Use extended thinking for complex problems
const response = await adapter.generateCompletion(
  "Analyze the following code for security vulnerabilities: [code snippet]",
  {
    thinking: {
      type: 'enabled',
      budget_tokens: 1000, // Allocate more tokens for complex analysis
    }
  } as AnthropicRequestOptions
);
```

### Streaming

1. **Handle errors gracefully**: Implement proper error handling for streaming responses.
2. **Process chunks efficiently**: Process streaming chunks efficiently to avoid blocking the main thread.
3. **Provide feedback to users**: Use streaming to provide immediate feedback to users while waiting for the complete response.

```typescript
// Handle streaming errors gracefully
try {
  const stream = adapter.generateCompletionStream(prompt, options);
  for await (const chunk of stream) {
    if (chunk.error) {
      console.error(`Error: ${chunk.errorDetails}`);
      break;
    }
    if (!chunk.done) {
      process.stdout.write(chunk.chunk);
    }
  }
} catch (error) {
  console.error("Streaming error:", error);
}
```

### Error Handling

1. **Set appropriate retry limits**: Configure `maxRetries` and `initialBackoff` based on your application's requirements.
2. **Handle specific error types**: Implement specific handling for different types of errors (authentication, rate limit, content filter, etc.).
3. **Implement fallbacks**: Consider implementing fallbacks to other models or services when Claude is unavailable.

```typescript
// Configure retry settings based on importance
const criticalOptions = {
  maxRetries: 5,        // More retries for critical requests
  initialBackoff: 500   // Start with a shorter backoff
} as AnthropicRequestOptions;

const nonCriticalOptions = {
  maxRetries: 2,        // Fewer retries for non-critical requests
  initialBackoff: 1000  // Start with a longer backoff
} as AnthropicRequestOptions;
```

## Conclusion

The enhanced Anthropic adapter provides a powerful interface to Claude's advanced capabilities while maintaining backward compatibility with existing code. By leveraging system messages, conversation history, tool usage, extended thinking, and enhanced streaming, you can build more sophisticated applications that take full advantage of Claude's capabilities.

For more information, refer to the [Anthropic API documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api) and the [integration tests](../test/integration/anthropic-adapter-integration.test.ts) for additional examples and usage patterns.