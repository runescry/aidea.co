import Anthropic from '@anthropic-ai/sdk';
import type { CompanyIdentity, CEODirective, ConflictReport, Cycle, SSEEvent } from '@/types';
import { MODELS } from '@/types';
import {
  buildCEOIdentityPrompt,
  buildCEODirectivePrompt,
  buildCEOReviewPrompt,
  buildCEOArbitrationPrompt,
} from '@/lib/prompts/ceo';

type Sender = (e: SSEEvent) => void;

function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in response: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

async function streamCEO(
  client: Anthropic,
  prompt: string,
  send: Sender,
  sessionId: string,
  cycleNumber: number
): Promise<string> {
  let fullText = '';

  const stream = client.messages.stream({
    model: MODELS.CEO,
    max_tokens: 8192,
    thinking: { type: 'enabled', budget_tokens: 3000 },
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({
        type: 'lead_stream_chunk',
        agent: 'ceo',
        sessionId,
        cycleNumber,
        data: { chunk: event.delta.text },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return fullText;
}

export async function runCEOIdentity(
  client: Anthropic,
  idea: string,
  send: Sender,
  sessionId: string
): Promise<CompanyIdentity> {
  const text = await streamCEO(client, buildCEOIdentityPrompt(idea), send, sessionId, 1);
  return parseJSON<CompanyIdentity>(text);
}

export async function runCEODirective(
  client: Anthropic,
  identity: CompanyIdentity,
  idea: string,
  cycleNumber: number,
  send: Sender,
  sessionId: string
): Promise<CEODirective> {
  const text = await streamCEO(
    client,
    buildCEODirectivePrompt(identity, idea, cycleNumber),
    send,
    sessionId,
    cycleNumber
  );
  const directive = parseJSON<CEODirective>(text);
  directive.issuedAt = new Date().toISOString();
  return directive;
}

export async function runCEOArbitration(
  client: Anthropic,
  conflictReport: ConflictReport,
  identity: CompanyIdentity,
  directive: CEODirective
): Promise<{ ceoArbitration: string; resolution: string }> {
  const msg = await client.messages.create({
    model: MODELS.CEO,
    max_tokens: 1024,
    thinking: { type: 'enabled', budget_tokens: 1000 },
    messages: [
      { role: 'user', content: buildCEOArbitrationPrompt(conflictReport, identity, directive) },
    ],
  });
  const text = msg.content.find(b => b.type === 'text')?.text ?? '{}';
  return parseJSON(text);
}

export async function runCEOReview(
  client: Anthropic,
  identity: CompanyIdentity,
  cycle: Cycle,
  conflictReport: ConflictReport | null,
  send: Sender,
  sessionId: string
): Promise<CEODirective> {
  const text = await streamCEO(
    client,
    buildCEOReviewPrompt(identity, cycle, conflictReport),
    send,
    sessionId,
    2
  );
  const directive = parseJSON<CEODirective>(text);
  directive.issuedAt = new Date().toISOString();
  return directive;
}
