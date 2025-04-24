import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createRouterService } from '../services/router.js';
// Assuming ChatMessage and ToolDefinition types align or can be adjusted
// We might need to redefine them based on Zod or ensure compatibility
import { ChatMessage as InternalChatMessage, ToolDefinition as InternalToolDefinition } from '../models/base-adapter.js';
import { translateToOpenAIResponse, translateToOpenAIStreamingFormat, formatSSE, extractUserPrompt } from '../utils/openai-translator.js';
import crypto from 'crypto';
import { getModelAdapter } from '../models/adapter-registry.js';

// --- Zod Schema Definitions ---

const ImageUrlSchema = z.object({
  url: z.string().url({ message: "Invalid URL format" }),
  detail: z.enum(['low', 'high', 'auto']).default('auto').optional(),
});

const ContentPartSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('image_url'),
    image_url: ImageUrlSchema,
  }),
]);

const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function', 'tool']),
  content: z.union([
    z.string(), // Allows simple string content
    z.array(ContentPartSchema).min(1, { message: "Content array must not be empty if provided" }) // Allows non-empty array of content parts
  ]).nullable(), // Allows null content (e.g., for assistant messages with tool calls but no text)
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

const FunctionDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()), // Represents JSON Schema object
});

const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: FunctionDefinitionSchema,
});

const ToolChoiceSchema = z.union([
  z.enum(['auto', 'none']),
  z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
    }),
  }),
]);

const ChatCompletionRequestBodySchema = z.object({
  model: z.string().optional().describe('Model ID to use'),
  messages: z.array(ChatMessageSchema).min(1, "Messages array cannot be empty"),
  temperature: z.number().min(0).max(2).default(0.7).optional(),
  max_tokens: z.number().int().positive().default(1024).optional(),
  stream: z.boolean().default(false).optional(),
  tools: z.array(ToolDefinitionSchema).optional(),
  tool_choice: ToolChoiceSchema.optional(),
});

// Infer the type for cleaner handler usage (requires fastify-type-provider-zod setup in app.ts)
type ChatCompletionRequest = FastifyRequest<{ Body: z.infer<typeof ChatCompletionRequestBodySchema> }>;

// --- Route Definition ---

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  createRouterService(fastify); // Keep service creation

  const routeOptions = {
    // Replace the old JSON schema with the Zod schema
    schema: {
      description: 'Chat completions API compatible with OpenAI specification (Zod validated)',
      tags: ['chat'],
      body: ChatCompletionRequestBodySchema,
      // TODO: Define Zod response schemas if needed for full type safety & validation
      // response: {
      //   200: ZodResponseSchema200,
      //   400: ZodResponseSchema400,
      //   500: ZodResponseSchema500
      // }
    },
    handler: async (request: ChatCompletionRequest, reply: any) => { // Use inferred type
      const startTime = Date.now();

      try {
        // Access validated and typed body directly
        const {
          messages,
          model: modelId,
          max_tokens, // Already has default from Zod
          temperature, // Already has default from Zod
          stream,      // Already has default from Zod
          tools,
          tool_choice
        } = request.body; // No need for manual type assertion

        // Log request (adjust based on Zod defaults if needed)
        request.log.info({
          messageCount: messages.length,
          modelId,
          maxTokens: max_tokens,
          temperature,
          stream,
          hasTools: !!tools && tools.length > 0,
          apiKeyId: (request as any).apiKey?.id, // Keep temporary 'any' for apiKey until fully typed
        }, 'Processing chat completion (Zod)');

        const completionId = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;

        if (stream) {
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          // Ensure messages conform to InternalChatMessage if different from Zod schema
          const internalMessages = messages as InternalChatMessage[];
          const userPrompt = extractUserPrompt(internalMessages);

          try {
            const adapter = getModelAdapter(fastify, modelId || 'gpt-4.1'); // Default model?

            if (!adapter.supportsStreaming || !adapter.generateCompletionStream) {
              throw new Error(`Model ${modelId || 'gpt-4.1'} does not support streaming`);
            }

            const options: any = {
              maxTokens: max_tokens,
              temperature,
              messages: internalMessages, // Use potentially casted messages
              stream: true,
              ...(tools ? { tools: tools as InternalToolDefinition[] } : {}), // Cast tools if needed
              ...(tool_choice ? { toolChoice: tool_choice } : {})
            };

            const stream = adapter.generateCompletionStream(userPrompt, options);

            for await (const chunk of stream) {
              const openAIChunk = translateToOpenAIStreamingFormat(chunk, completionId);
              const sseData = formatSSE(openAIChunk);
              reply.raw.write(sseData);
              if (chunk.done) {
                reply.raw.write(formatSSE('DONE'));
                break;
              }
            }
            reply.raw.end();

            request.log.info({
              messageCount: messages.length,
              modelId: modelId || 'gpt-4.1',
              streaming: true,
              processingTime: (Date.now() - startTime) / 1000,
            }, 'Chat completion streaming completed (Zod)');
            return; // Important: return nothing for streaming reply

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            request.log.error({ error, messageCount: messages.length, modelId, streaming: true }, 'Error processing streaming chat completion (Zod)');

            const errorChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelId || 'gpt-4.1',
              choices: [{ index: 0, delta: { content: `Error: ${errorMessage}` }, finish_reason: 'error' }]
            };
            reply.raw.write(formatSSE(errorChunk));
            reply.raw.write(formatSSE('DONE'));
            reply.raw.end();
            return; // Important: return nothing for streaming reply
          }
        }

        // --- Non-streaming ---
        // Ensure messages conform to InternalChatMessage if different from Zod schema
        const internalMessages = messages as InternalChatMessage[];
        const userPrompt = extractUserPrompt(internalMessages);

        if (!userPrompt) {
          reply.code(400);
          return { error: 'No user message found in the messages array', code: 'INVALID_MESSAGES', requestId: request.id };
        }

        const adapter = getModelAdapter(fastify, modelId || 'gpt-4.1'); // Default model?

        const options: any = {
          maxTokens: max_tokens,
          temperature,
          messages: internalMessages, // Use potentially casted messages
          ...(tools ? { tools: tools as InternalToolDefinition[] } : {}), // Cast tools if needed
          ...(tool_choice ? { toolChoice: tool_choice } : {})
        };

        const modelResponse = await adapter.generateCompletion(userPrompt, options);
        const openAIResponse = translateToOpenAIResponse(modelResponse);
        openAIResponse.id = completionId;

        request.log.info({
          modelUsed: modelResponse.model,
          tokens: modelResponse.tokens,
          processingTime: (Date.now() - startTime) / 1000,
        }, 'Chat completion processed successfully (Zod)');

        return openAIResponse;

      } catch (error: unknown) {
        // Handle Zod validation errors specifically
        if (error instanceof z.ZodError) {
            request.log.error({ error: error.format() }, 'Zod validation error processing chat completion');
            reply.code(400);
            return {
                error: "Invalid request body",
                code: "VALIDATION_ERROR",
                details: error.format(), // Provide detailed validation errors
                request_id: request.id,
            };
        }

        // Handle other errors
        request.log.error(error, 'Error processing chat completion (Zod)');
        let statusCode = 500;
        let errorMessage = 'An error occurred while processing the chat completion';
        let errorCode = 'INTERNAL_ERROR';

        if (error && typeof error === 'object') {
          if ('statusCode' in error && typeof error.statusCode === 'number') statusCode = error.statusCode;
          if ('message' in error && typeof error.message === 'string') errorMessage = error.message;
          if ('code' in error && typeof error.code === 'string') errorCode = error.code;
        }

        reply.code(statusCode);
        return { error: errorMessage, code: errorCode, request_id: request.id };
      }
    },
  };

  // Add authentication if available (assuming decorator exists)
  if ((fastify as any).hasDecorator('authenticate')) {
    (routeOptions as any).onRequest = [(fastify as any).authenticate];
  }

  // Register the route with the Zod schema
  fastify.post('/completions', routeOptions);
};

export default chatRoutes;