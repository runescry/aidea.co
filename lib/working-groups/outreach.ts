import Anthropic from '@anthropic-ai/sdk';
import type { CompanyIdentity, CMOOutput, CPOOutput, OutreachArtifact, SSEEvent } from '@/types';
import { MODELS } from '@/types';
import { buildOutreachPrompt } from '@/lib/prompts/working-groups';

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in outreach response`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function runOutreach(
  client: Anthropic,
  identity: CompanyIdentity,
  cmoOutput: CMOOutput,
  cpoOutput: CPOOutput,
  send: (e: SSEEvent) => void,
  sessionId: string
): Promise<OutreachArtifact> {
  let fullText = '';

  const stream = client.messages.stream({
    model: MODELS.WORKING_GROUPS,
    max_tokens: 8192,
    messages: [{ role: 'user', content: buildOutreachPrompt(identity, cmoOutput, cpoOutput) }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({
        type: 'working_group_stream_chunk',
        agent: 'outreach',
        sessionId,
        cycleNumber: 1,
        data: { chunk: event.delta.text },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return parseJSON<OutreachArtifact>(fullText);
}
