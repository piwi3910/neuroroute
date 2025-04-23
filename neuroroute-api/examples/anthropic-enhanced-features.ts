import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { AnthropicAdapter, AnthropicRequestOptions } from '../src/models/anthropic-adapter.js';
import { ToolDefinition } from '../src/models/base-adapter.js';

/**
 * This example demonstrates the enhanced features of the Anthropic adapter:
 * - System messages
 * - Conversation history
 * - Tool usage
 * - Extended thinking
 */
async function runExample() {
  // Create a Fastify instance
  const app: FastifyInstance = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });

  // Add config for API key
  app.decorate('config', {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });

  try {
    // Create Anthropic adapter
    const adapter = new AnthropicAdapter(app, 'claude-3-sonnet');

    // Check if the adapter is available
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      console.error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
      return;
    }

    console.log('Running Anthropic enhanced features example...');

    // Example 1: Using system message
    console.log('\n--- Example 1: Using system message ---');
    const systemMessageResponse = await adapter.generateCompletion(
      'What is your role?',
      {
        systemMessage: 'You are a helpful AI assistant that specializes in explaining complex technical concepts in simple terms.',
        maxTokens: 100,
      } as AnthropicRequestOptions
    );
    console.log(`Response: ${systemMessageResponse.text}`);

    // Example 2: Using conversation history
    console.log('\n--- Example 2: Using conversation history ---');
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

    // Example 3: Using tool usage
    console.log('\n--- Example 3: Using tool usage ---');
    
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

    const toolUsageResponse = await adapter.generateCompletion(
      'What\'s the weather like in San Francisco?',
      {
        tools: [weatherTool],
        toolChoice: 'auto',
        maxTokens: 200,
      } as AnthropicRequestOptions
    );

    console.log('Response:');
    console.log(`Text: ${toolUsageResponse.text}`);
    
    if (toolUsageResponse.toolCalls) {
      console.log('Tool Calls:');
      toolUsageResponse.toolCalls.forEach(toolCall => {
        console.log(`- Tool: ${toolCall.function.name}`);
        console.log(`  Arguments: ${toolCall.function.arguments}`);
      });
    }

    // Example 4: Using extended thinking
    console.log('\n--- Example 4: Using extended thinking ---');
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

    // Example 5: Streaming with system message
    console.log('\n--- Example 5: Streaming with system message ---');
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
    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

// Run the example
runExample().catch(console.error);