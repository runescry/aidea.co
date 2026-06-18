import Anthropic from '@anthropic-ai/sdk';
import type { CompanyIdentity, CMOOutput, CPOOutput, CEODirective, CopywriterArtifact, SSEEvent } from '@/types';
import { MODELS } from '@/types';
import { buildCopywriterPrompt } from '@/lib/prompts/working-groups';

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in copywriter response`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function runCopywriter(
  client: Anthropic,
  identity: CompanyIdentity,
  cmoOutput: CMOOutput,
  cpoOutput: CPOOutput,
  directive: CEODirective,
  send: (e: SSEEvent) => void,
  sessionId: string
): Promise<CopywriterArtifact> {
  let fullText = '';

  const stream = client.messages.stream({
    model: MODELS.WORKING_GROUPS,
    max_tokens: 8192,
    messages: [{ role: 'user', content: buildCopywriterPrompt(identity, cmoOutput, cpoOutput, directive) }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({
        type: 'working_group_stream_chunk',
        agent: 'copywriter',
        sessionId,
        cycleNumber: 1,
        data: { chunk: event.delta.text },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return parseJSON<CopywriterArtifact>(fullText);
}
