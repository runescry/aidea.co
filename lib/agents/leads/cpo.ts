import Anthropic from '@anthropic-ai/sdk';
import type { CompanyIdentity, CEODirective, CPOOutput, SSEEvent } from '@/types';
import { MODELS } from '@/types';
import { buildCPOPrompt } from '@/lib/prompts/leads';

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in CPO response`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function runCPO(
  client: Anthropic,
  identity: CompanyIdentity,
  directive: CEODirective,
  send: (e: SSEEvent) => void,
  sessionId: string
): Promise<CPOOutput> {
  let fullText = '';

  const stream = client.messages.stream({
    model: MODELS.LEADS,
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildCPOPrompt(identity, directive) }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({
        type: 'lead_stream_chunk',
        agent: 'cpo',
        sessionId,
        cycleNumber: 1,
        data: { chunk: event.delta.text },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return parseJSON<CPOOutput>(fullText);
}
