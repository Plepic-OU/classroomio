import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * General-purpose agent powered by Claude Haiku 4.5.
 * Best for fast, cost-effective tasks: quick lookups, simple Q&A, summarization.
 */
export async function runHaikuAgent(prompt: string): Promise<string> {
  let result = '';

  for await (const message of query({
    prompt,
    options: {
      model: 'claude-haiku-4-5',
      allowedTools: ['Read', 'Glob', 'Grep'],
    },
  })) {
    if ('result' in message) {
      result = message.result;
    }
  }

  return result;
}
