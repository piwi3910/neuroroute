/**
 * Example demonstrating the enhanced OpenAI adapter features
 * 
 * This example shows how to use:
 * 1. System messages
 * 2. Conversation history
 * 3. Function calling
 * 4. Tool calling
 */

import Fastify from 'fastify';
import createOpenAIAdapter, { OpenAIRequestOptions } from '../src/models/openai-adapter.js';
import { ChatMessage, FunctionDefinition, ToolDefinition } from '../src/models/base-adapter.js';

// Create a Fastify instance
const app = Fastify({
  logger: {
    level: 'info'
  }
});

// Load environment variables (in a real app, use dotenv or similar)
app.decorate('config', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  // Add required config properties with default values
  PORT: 3000,
  HOST: 'localhost',
  NODE_ENV: 'development',
  DATABASE_URL: '',
  REDIS_URL: '',
  REDIS_CACHE_TTL: 300,
  JWT_SECRET: 'example-secret',
  JWT_EXPIRATION: '1h',
  LOG_LEVEL: 'info',
  API_RATE_LIMIT: 200,
  API_TIMEOUT: 30000,
  ENABLE_CACHE: true,
  ENABLE_SWAGGER: true,
  ENABLE_JWT_AUTH: true,
  ENABLE_DYNAMIC_CONFIG: true,
  ENABLE_METRICS: true,
  ENABLE_TRACING: false,
  COST_OPTIMIZE: false,
  QUALITY_OPTIMIZE: true,
  LATENCY_OPTIMIZE: false,
  FALLBACK_ENABLED: true,
  CHAIN_ENABLED: false,
  CACHE_STRATEGY: 'default'
} as any); // Using 'as any' for simplicity in this example

// Create the OpenAI adapter
const adapter = createOpenAIAdapter(app, 'gpt-4');

/**
 * Example 1: Using system messages
 */
async function exampleWithSystemMessage() {
  console.log('\n--- Example 1: Using System Messages ---\n');
  
  try {
    const response = await adapter.generateCompletion(
      'What is the capital of France?',
      {
        systemMessage: 'You are a helpful geography teacher. Keep answers brief and educational.',
        temperature: 0.7
      } as OpenAIRequestOptions
    );
    
    console.log('Response with system message:');
    console.log(response.text);
    console.log('\nTokens used:', response.tokens.total);
  } catch (error) {
    console.error('Error in system message example:', error);
  }
}

/**
 * Example 2: Using conversation history
 */
async function exampleWithConversationHistory() {
  console.log('\n--- Example 2: Using Conversation History ---\n');
  
  try {
    // Define a conversation history
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I\'m doing well, thank you for asking! How can I help you today?' },
      { role: 'user', content: 'Tell me about the solar system.' }
    ];
    
    const response = await adapter.generateCompletion(
      '', // Empty prompt since we're using messages
      {
        messages: messages,
        temperature: 0.7
      } as OpenAIRequestOptions
    );
    
    console.log('Response with conversation history:');
    console.log(response.text);
    console.log('\nTokens used:', response.tokens.total);
    
    // Show the updated conversation history
    console.log('\nUpdated conversation history:');
    response.messages?.forEach((message, index) => {
      console.log(`[${index + 1}] ${message.role}: ${message.content?.substring(0, 50)}${message.content && message.content.length > 50 ? '...' : ''}`);
    });
  } catch (error) {
    console.error('Error in conversation history example:', error);
  }
}

/**
 * Example 3: Using function calling
 */
async function exampleWithFunctionCalling() {
  console.log('\n--- Example 3: Using Function Calling ---\n');
  
  try {
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
      
      console.log('\nContinuing conversation with function result...');
      
      const followUpResponse = await adapter.generateCompletion(
        '',
        {
          messages: followUpMessages,
          temperature: 0.7
        } as OpenAIRequestOptions
      );
      
      console.log('\nFollow-up response:');
      console.log(followUpResponse.text);
    } else {
      console.log('Response without function call:');
      console.log(response.text);
    }
    
    console.log('\nTokens used:', response.tokens.total);
  } catch (error) {
    console.error('Error in function calling example:', error);
  }
}

/**
 * Example 4: Using tool calling
 */
async function exampleWithToolCalling() {
  console.log('\n--- Example 4: Using Tool Calling ---\n');
  
  try {
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
      
      console.log('\nContinuing conversation with tool result...');
      
      const followUpResponse = await adapter.generateCompletion(
        '',
        {
          messages: followUpMessages,
          temperature: 0.7
        } as OpenAIRequestOptions
      );
      
      console.log('\nFollow-up response:');
      console.log(followUpResponse.text);
    } else {
      console.log('Response without tool call:');
      console.log(response.text);
    }
    
    console.log('\nTokens used:', response.tokens.total);
  } catch (error) {
    console.error('Error in tool calling example:', error);
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    // Check if the adapter is available
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      console.error('OpenAI API is not available. Please check your API key.');
      return;
    }
    
    // Run examples
    await exampleWithSystemMessage();
    await exampleWithConversationHistory();
    await exampleWithFunctionCalling();
    await exampleWithToolCalling();
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Close the Fastify app
    await app.close();
  }
}

// Run the examples
runExamples().catch(console.error);