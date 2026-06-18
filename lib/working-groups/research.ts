import Anthropic from '@anthropic-ai/sdk';
import type { CompanyIdentity, CPOOutput, CMOOutput, ResearchArtifact, SSEEvent } from '@/types';
import { MODELS } from '@/types';
import { buildResearchPrompt } from '@/lib/prompts/working-groups';

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in research response`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function runResearch(
  client: Anthropic,
  identity: CompanyIdentity,
  cpoOutput: CPOOutput,
  cmoOutput: CMOOutput,
  send: (e: SSEEvent) => void,
  sessionId: string
): Promise<ResearchArtifact> {
  let fullText = '';

  const stream = client.messages.stream({
    model: MODELS.WORKING_GROUPS,
    max_tokens: 8192,
    messages: [{ role: 'user', content: buildResearchPrompt(identity, cpoOutput, cmoOutput) }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({
        type: 'working_group_stream_chunk',
        agent: 'research',
        sessionId,
        cycleNumber: 1,
        data: { chunk: event.delta.text },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return parseJSON<ResearchArtifact>(fullText);
}
