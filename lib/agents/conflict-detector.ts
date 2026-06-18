import Anthropic from '@anthropic-ai/sdk';
import type { CMOOutput, CTOOutput, CompanyIdentity, ConflictReport } from '@/types';
import { MODELS } from '@/types';
import { buildConflictDetectorPrompt } from '@/lib/prompts/conflict';

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in conflict response: ${text.slice(0, 100)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function runConflictDetector(
  client: Anthropic,
  cmoOutput: CMOOutput,
  ctoOutput: CTOOutput,
  identity: CompanyIdentity
): Promise<ConflictReport> {
  const msg = await client.messages.create({
    model: MODELS.CONFLICT,
    max_tokens: 512,
    messages: [
      { role: 'user', content: buildConflictDetectorPrompt(cmoOutput, ctoOutput, identity) },
    ],
  });
  const text = msg.content.find(b => b.type === 'text')?.text ?? '{}';
  return parseJSON<ConflictReport>(text);
}
