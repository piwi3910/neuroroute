import { FastifyPluginAsync } from 'fastify';
import { createRouterService } from '../services/router.js';
import { ChatMessage, ToolDefinition } from '../models/base-adapter.js';
import { translateToOpenAIResponse, translateToOpenAIStreamingFormat, formatSSE, extractUserPrompt } from '../utils/openai-translator.js';
import crypto from 'crypto';
import { getModelAdapter } from '../models/adapter-registry.js';

/**
 * Chat completions API compatible with OpenAI specification
 * 
 * This endpoint provides an OpenAI-compatible chat completions API
 * that leverages our multi-provider architecture behind the scenes.
 */
const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // Create router service for future use
  createRouterService(fastify);
  
  // Create route options
  const routeOptions: any = {
    schema: {
      description: 'Chat completions API compatible with OpenAI specification',
      tags: ['chat'],
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          model: { type: 'string', description: 'Model ID to use' },
          messages: { 
            type: 'array', 
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['system', 'user', 'assistant', 'function', 'tool'] },
                content: { type: 'string', nullable: true },
                name: { type: 'string' },
                tool_call_id: { type: 'string' }
              }
            }
          },
          temperature: { type: 'number', default: 0.7 },
          max_tokens: { type: 'integer', default: 1024 },
          stream: { type: 'boolean', default: false },
          tools: { 
            type: 'array', 
            items: { 
              type: 'object',
              required: ['type', 'function'],
              properties: {
                type: { type: 'string', enum: ['function'] },
                function: {
                  type: 'object',
                  required: ['name', 'parameters'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    parameters: { type: 'object' }
                  }
                }
              }
            } 
          },
          tool_choice: { 
            oneOf: [
              { type: 'string', enum: ['auto', 'none'] },
              { 
                type: 'object',
                required: ['type', 'function'],
                properties: {
                  type: { type: 'string', enum: ['function'] },
                  function: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                      name: { type: 'string' }
                    }
                  }
                }
              }
            ]
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            object: { type: 'string', default: 'chat.completion' },
            created: { type: 'integer' },
            model: { type: 'string' },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer' },
                  message: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      content: { type: 'string', nullable: true },
                      tool_calls: { 
                        type: 'array', 
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            type: { type: 'string' },
                            function: {
                              type: 'object',
                              properties: {
                                name: { type: 'string' },
                                arguments: { type: 'string' }
                              }
                            }
                          }
                        } 
                      }
                    }
                  },
                  finish_reason: { type: 'string' }
                }
              }
            },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: { type: 'integer' },
                completion_tokens: { type: 'integer' },
                total_tokens: { type: 'integer' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (request: any, reply: any) => {
      const startTime = Date.now();
      
      try {
        const { 
          messages, 
          model: modelId, 
          max_tokens = 1024, 
          temperature = 0.7,
          stream = false,
          tools,
          tool_choice
        } = request.body as {
          messages: ChatMessage[];
          model?: string;
          max_tokens?: number;
          temperature?: number;
          stream?: boolean;
          tools?: ToolDefinition[];
          tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
        };

        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          reply.code(400);
          return {
            error: 'Messages are required and must be a non-empty array',
            code: 'INVALID_MESSAGES',
            requestId: request.id,
          };
        }
        
        // Log request
        request.log.info({
          messageCount: messages.length,
          modelId,
          maxTokens: max_tokens,
          temperature,
          stream,
          hasTools: !!tools && tools.length > 0,
          apiKeyId: request.apiKey?.id,
        }, 'Processing chat completion');
        
        // Generate a unique ID for this completion
        const completionId = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
        
        // Handle streaming response
        if (stream) {
          // Set appropriate headers for SSE
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          
          // Extract the user prompt for classification
          const userPrompt = extractUserPrompt(messages);
          
          try {
            // Get the appropriate adapter for this model
            const adapter = getModelAdapter(fastify, modelId || 'gpt-4.1');
            
            // Check if the adapter supports streaming
            if (!adapter.supportsStreaming || !adapter.generateCompletionStream) {
              throw new Error(`Model ${modelId || 'gpt-4.1'} does not support streaming`);
            }
            
            // Prepare request options
            const options: any = {
              maxTokens: max_tokens,
              temperature,
              messages,
              stream: true,
              ...(tools ? { tools } : {}),
              ...(tool_choice ? { toolChoice: tool_choice } : {})
            };
            
            // Generate streaming completion
            const stream = adapter.generateCompletionStream(userPrompt, options);
            
            // Process each chunk
            for await (const chunk of stream) {
              // Translate to OpenAI format
              const openAIChunk = translateToOpenAIStreamingFormat(chunk, completionId);
              
              // Format as SSE and send
              const sseData = formatSSE(openAIChunk);
              reply.raw.write(sseData);
              
              // If this is the final chunk, send [DONE]
              if (chunk.done) {
                reply.raw.write(formatSSE('DONE'));
                break;
              }
            }
            
            // End the response
            reply.raw.end();
            
            // Log success
            request.log.info({
              messageCount: messages.length,
              modelId: modelId || 'gpt-4.1',
              streaming: true,
              processingTime: (Date.now() - startTime) / 1000,
            }, 'Chat completion streaming completed');
            
            return;
          } catch (error) {
            // For streaming, we need to send an error as an SSE event
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Log error
            request.log.error({
              error,
              messageCount: messages.length,
              modelId,
              streaming: true,
            }, 'Error processing streaming chat completion');
            
            // Send error as SSE
            const errorChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelId || 'gpt-4.1',
              choices: [{
                index: 0,
                delta: { content: `Error: ${errorMessage}` },
                finish_reason: 'error'
              }]
            };
            
            reply.raw.write(formatSSE(errorChunk));
            reply.raw.write(formatSSE('DONE'));
            reply.raw.end();
            
            return;
          }
        }
        
        // Non-streaming response
        // Use router service to process the chat completion
        // For now, we'll extract the user prompt and use the existing routePrompt method
        // In a real implementation, we'd add a routeChatCompletion method to the router service
        
        // Extract the user prompt for classification
        const userPrompt = extractUserPrompt(messages);
        
        if (!userPrompt) {
          reply.code(400);
          return {
            error: 'No user message found in the messages array',
            code: 'INVALID_MESSAGES',
            requestId: request.id,
          };
        }
        
        // Get the appropriate adapter for this model
        const adapter = getModelAdapter(fastify, modelId || 'gpt-4.1');
        
        // Prepare request options
        const options: any = {
          maxTokens: max_tokens,
          temperature,
          messages, // Pass the full messages array
          ...(tools ? { tools } : {}),
          ...(tool_choice ? { toolChoice: tool_choice } : {})
        };
        
        // Generate completion using the adapter
        const modelResponse = await adapter.generateCompletion(userPrompt, options);
        
        // Translate to OpenAI format
        const openAIResponse = translateToOpenAIResponse(modelResponse);
        
        // Add request ID
        openAIResponse.id = completionId;
        
        // Log response
        request.log.info({
          modelUsed: modelResponse.model,
          tokens: modelResponse.tokens,
          processingTime: (Date.now() - startTime) / 1000,
        }, 'Chat completion processed successfully');
        
        return openAIResponse;
      } catch (error: unknown) {
        // Log error
        request.log.error(error, 'Error processing chat completion');
        
        // Determine status code and error details
        let statusCode = 500;
        let errorMessage = 'An error occurred while processing the chat completion';
        let errorCode = 'INTERNAL_ERROR';
        
        // Handle known error types
        if (error && typeof error === 'object') {
          if ('statusCode' in error && typeof error.statusCode === 'number') {
            statusCode = error.statusCode;
          }
          
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          }
          
          if ('code' in error && typeof error.code === 'string') {
            errorCode = error.code;
          }
        }
        
        reply.code(statusCode);
        
        // Return error response
        return {
          error: errorMessage,
          code: errorCode,
          request_id: request.id,
        };
      }
    },
  };
  
  // Add authentication if available
  if (fastify.hasDecorator('authenticate')) {
    routeOptions.onRequest = [fastify.authenticate];
  }
  
  // Register the route
  fastify.post('/completions', routeOptions);
};


export default chatRoutes;