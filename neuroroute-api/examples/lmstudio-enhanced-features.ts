/**
 * Example demonstrating the enhanced features of the LMStudio adapter
 * 
 * This example shows how to use:
 * 1. Conversation history
 * 2. Function calling
 * 3. Tool usage
 * 4. Error handling with retries and circuit breaker
 * 5. Streaming with function calls
 * 
 * To run this example:
 * 1. Make sure LMStudio is running locally with the API server enabled
 * 2. Run: ts-node examples/lmstudio-enhanced-features.ts
 */

import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { LMStudioAdapter } from '../src/models/lmstudio-adapter.js';
import { ChatMessage, FunctionDefinition, ToolDefinition } from '../src/models/base-adapter.js';

// Create a simple Fastify instance for the adapter
const fastify = Fastify({
  logger: {
    level: 'info',
  }
});

// Initialize the adapter with a model ID
// Replace with your actual model ID from LMStudio
const modelId = 'llama3';
const adapter = new LMStudioAdapter(fastify, modelId);

// Example 1: Basic completion with system message
async function basicCompletion() {
  console.log('\n=== Example 1: Basic Completion ===\n');
  
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

// Example 2: Conversation history
async function conversationHistory() {
  console.log('\n=== Example 2: Conversation History ===\n');
  
  try {
    // Create a conversation history
    const messages: ChatMessage[] = [
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
    
    console.log('\nFollow-up response:', followUpResponse.text);
  } catch (error) {
    console.error('Error in conversation history:', error);
  }
}

// Example 3: Function calling
async function functionCalling() {
  console.log('\n=== Example 3: Function Calling ===\n');
  
  try {
    // Define a function for the model to call
    const functions: FunctionDefinition[] = [
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
      console.log('\nHandling function call...');
      
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
      
      console.log('\nFunction result:', functionResult);
      
      // Continue the conversation with the function result
      const messages: ChatMessage[] = [
        ...(response.messages || []),
        {
          role: 'function' as const,
          name: 'get_weather',
          content: JSON.stringify(functionResult)
        }
      ];
      
      const followUpResponse = await adapter.generateCompletion('', { messages });
      
      console.log('\nFollow-up response:', followUpResponse.text);
    }
  } catch (error) {
    console.error('Error in function calling:', error);
  }
}

// Example 4: Tool usage
async function toolUsage() {
  console.log('\n=== Example 4: Tool Usage ===\n');
  
  try {
    // Define tools for the model to use
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
      console.log('\nHandling tool calls...');
      
      const toolResponses: any[] = [];
      
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
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          } as ChatMessage);
        }
      }
      
      // Continue the conversation with the tool results
      const messages: any[] = [
        ...(response.messages || []),
        ...toolResponses
      ];
      
      const followUpResponse = await adapter.generateCompletion('', { messages });
      
      console.log('\nFollow-up response:', followUpResponse.text);
    }
  } catch (error) {
    console.error('Error in tool usage:', error);
  }
}

// Example 5: Streaming with function calls
async function streamingWithFunctionCalls() {
  console.log('\n=== Example 5: Streaming with Function Calls ===\n');
  
  try {
    // Define a function for the model to call
    const functions: FunctionDefinition[] = [
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

// Example 6: Error handling with retries
async function errorHandlingWithRetries() {
  console.log('\n=== Example 6: Error Handling with Retries ===\n');
  
  try {
    // Intentionally use an invalid URL to trigger retries
    // This is just for demonstration - in a real scenario, the adapter would retry on network errors
    const originalBaseUrl = (adapter as any).baseUrl;
    (adapter as any).baseUrl = 'http://invalid-url:1234/v1';
    
    console.log('Using invalid URL to demonstrate retries...');
    
    try {
      await adapter.generateCompletion(
        'This should trigger retries due to connection error',
        {
          maxRetries: 2,
          initialBackoff: 100 // Short backoff for the example
        }
      );
    } catch (error) {
      console.log('Error caught after retries:', error.message);
    }
    
    // Restore the original URL
    (adapter as any).baseUrl = originalBaseUrl;
  } catch (error) {
    console.error('Error in error handling example:', error);
  }
}

// Run all examples
async function runExamples() {
  // Check if the model is available
  const isAvailable = await adapter.isAvailable();
  
  if (!isAvailable) {
    console.error('LMStudio model is not available. Make sure LMStudio is running with the API server enabled.');
    return;
  }
  
  console.log(`LMStudio model '${modelId}' is available.`);
  console.log('Model capabilities:', adapter.getCapabilities());
  console.log('Model details:', adapter.getDetails());
  
  // Run examples
  await basicCompletion();
  await conversationHistory();
  await functionCalling();
  await toolUsage();
  await streamingWithFunctionCalls();
  await errorHandlingWithRetries();
  
  console.log('\nAll examples completed.');
}

// Run the examples
runExamples().catch(error => {
  console.error('Error running examples:', error);
});