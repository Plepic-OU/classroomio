import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * General-purpose agent powered by Claude Opus 4.6.
 * Best for complex reasoning, deep analysis, and tasks requiring maximum intelligence.
 */
export async function runOpusAgent(prompt: string): Promise<string> {
  let result = '';

  for await (const message of query({
    prompt,
    options: {
      model: 'claude-opus-4-6',
      allowedTools: ['Read', 'Glob', 'Grep'],
      thinking: { type: 'adaptive' },
    },
  })) {
    if ('result' in message) {
      result = message.result;
    }
  }

  return result;
}
