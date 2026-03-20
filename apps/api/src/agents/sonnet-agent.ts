import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * General-purpose agent powered by Claude Sonnet 4.6.
 * Best for balanced speed and intelligence: code review, structured analysis, multi-step tasks.
 */
export async function runSonnetAgent(prompt: string): Promise<string> {
  let result = '';

  for await (const message of query({
    prompt,
    options: {
      model: 'claude-sonnet-4-6',
      allowedTools: ['Read', 'Glob', 'Grep'],
    },
  })) {
    if ('result' in message) {
      result = message.result;
    }
  }

  return result;
}
