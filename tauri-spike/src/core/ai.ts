/** OpenAI-compatible chat request helpers. */
import type { McpContext } from './mcp';

export interface AiChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
}

export interface AiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Normalize and validate an OpenAI-compatible HTTP endpoint. */
export function normalizeAiEndpoint(value: string): string | null {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function createAiChatRequest(
  model: string,
  prompt: string,
  context: McpContext,
): AiChatRequest {
  return {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a mindmap assistant. Suggest concise, actionable improvements. Do not claim to have edited the document.',
      },
      {
        role: 'user',
        content: `${prompt}\n\nCurrent mindmap:\n${context.current.markdown}`,
      },
    ],
  };
}

export function readAiChatResponse(value: unknown): string {
  const response = value as AiChatResponse;
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI 返回内容为空');
  return content;
}
