import Anthropic from '@anthropic-ai/sdk';
import type { CompanyIdentity, CPOOutput, CFOOutput, PricingArtifact, SSEEvent } from '@/types';
import { MODELS } from '@/types';
import { buildPricingPrompt } from '@/lib/prompts/working-groups';

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in pricing response`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function runPricing(
  client: Anthropic,
  identity: CompanyIdentity,
  cpoOutput: CPOOutput,
  cfoOutput: CFOOutput,
  send: (e: SSEEvent) => void,
  sessionId: string
): Promise<PricingArtifact> {
  let fullText = '';

  const stream = client.messages.stream({
    model: MODELS.WORKING_GROUPS,
    max_tokens: 16384,
    messages: [{ role: 'user', content: buildPricingPrompt(identity, cpoOutput, cfoOutput) }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({
        type: 'working_group_stream_chunk',
        agent: 'pricing',
        sessionId,
        cycleNumber: 1,
        data: { chunk: event.delta.text },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return parseJSON<PricingArtifact>(fullText);
}
