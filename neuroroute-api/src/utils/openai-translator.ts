import { 
  ChatMessage, 
  ModelResponse, 
  StreamingChunk, 
  ToolCall, 
  FunctionCall 
} from '../models/base-adapter.js';
import crypto from 'crypto';

/**
 * OpenAI Chat Completion Response format
 */
export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      function_call?: FunctionCall;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chat Completion Streaming Response format
 */
export interface OpenAIChatCompletionStreamingChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      function_call?: Partial<FunctionCall>;
      tool_calls?: Partial<ToolCall>[];
    };
    finish_reason: string | null;
  }[];
}

/**
 * Translate our internal ModelResponse to OpenAI's chat completion format
 * 
 * @param response The internal model response
 * @returns OpenAI-compatible chat completion response
 */
export function translateToOpenAIResponse(response: ModelResponse): OpenAIChatCompletionResponse {
  // Generate a unique ID for the response
  const id = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
  
  // Create the OpenAI-compatible response
  const openAIResponse: OpenAIChatCompletionResponse = {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: response.text,
          ...(response.functionCall ? { function_call: response.functionCall } : {}),
          ...(response.toolCalls ? { tool_calls: response.toolCalls } : {})
        },
        finish_reason: 'stop' // Default finish reason
      }
    ],
    usage: {
      prompt_tokens: response.tokens.prompt,
      completion_tokens: response.tokens.completion,
      total_tokens: response.tokens.total
    }
  };
  
  return openAIResponse;
}

/**
 * Translate a streaming chunk to OpenAI's streaming format
 * 
 * @param chunk The streaming chunk
 * @param id The response ID (should be consistent across chunks)
 * @returns OpenAI-compatible streaming chunk
 */
export function translateToOpenAIStreamingFormat(
  chunk: StreamingChunk, 
  id: string
): OpenAIChatCompletionStreamingChunk {
  // Parse function call or tool call content if present
  let functionCall: Partial<FunctionCall> | undefined;
  let toolCalls: Partial<ToolCall>[] | undefined;
  
  if (chunk.chunk.startsWith('[Function Call]:')) {
    try {
      const functionCallJson = chunk.chunk.replace('[Function Call]:', '').trim();
      functionCall = JSON.parse(functionCallJson);
    } catch {
      // Ignore parsing errors
    }
  } else if (chunk.chunk.startsWith('[Tool Call]:')) {
    try {
      const toolCallJson = chunk.chunk.replace('[Tool Call]:', '').trim();
      toolCalls = JSON.parse(toolCallJson);
    } catch {
      // Ignore parsing errors
    }
  }
  
  // Create the OpenAI-compatible streaming chunk
  const openAIChunk: OpenAIChatCompletionStreamingChunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: chunk.model,
    choices: [
      {
        index: 0,
        delta: {
          // Only include content if it's a regular text chunk
          ...((!functionCall && !toolCalls) ? { content: chunk.chunk } : {}),
          // Include function call if present
          ...(functionCall ? { function_call: functionCall } : {}),
          // Include tool calls if present
          ...(toolCalls ? { tool_calls: toolCalls } : {})
        },
        finish_reason: chunk.done ? (chunk.finishReason || 'stop') : null
      }
    ]
  };
  
  return openAIChunk;
}

/**
 * Format a streaming chunk as a Server-Sent Event
 * 
 * @param chunk The OpenAI-compatible streaming chunk
 * @param done Whether this is the final [DONE] message
 * @returns Formatted SSE data
 */
export function formatSSE(chunk: OpenAIChatCompletionStreamingChunk | 'DONE'): string {
  if (chunk === 'DONE') {
    return 'data: [DONE]\n\n';
  }
  
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Extract the user's prompt from an array of chat messages
 * 
 * @param messages Array of chat messages
 * @returns The last user message content or empty string if none found
 */
export function extractUserPrompt(messages: ChatMessage[]): string {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && messages[i].content) {
      return messages[i].content!;
    }
  }
  
  return '';
}