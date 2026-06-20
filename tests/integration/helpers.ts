import { NextRequest } from 'next/server';
import { consumeHarnessSSE } from '@/lib/client/sse';
import { hasApiKey, useAiGateway } from '@/lib/ai/provider';
import type { HarnessEvent } from '@/lib/harness/types';
import { loadEnvLocal } from './setup';

loadEnvLocal();

export function isIntegrationRun(): boolean {
  return process.env.RUN_INTEGRATION === '1';
}

export function hasLlmKey(): boolean {
  return hasApiKey();
}

export function hasValidLlmKey(): boolean {
  if (!hasLlmKey()) return false;
  if (useAiGateway()) {
    const key = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN ?? '';
    return key.length > 10;
  }
  const anthropic = process.env.ANTHROPIC_API_KEY ?? '';
  return anthropic.startsWith('sk-ant-') && !anthropic.includes('YOUR_KEY');
}

export function runChatScenarios(): boolean {
  return process.env.INTEGRATION_CHAT === '1' && hasValidLlmKey();
}

export function testBaseUrl(): string | undefined {
  return process.env.TEST_BASE_URL?.replace(/\/$/, '') || undefined;
}

function jsonRequest(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function collectHarnessEvents(res: Response): Promise<HarnessEvent[]> {
  const events: HarnessEvent[] = [];
  await consumeHarnessSSE<HarnessEvent>(res, (event) => events.push(event));
  return events;
}

async function httpFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = testBaseUrl();
  if (!base) throw new Error('TEST_BASE_URL is required for HTTP mode');
  return fetch(`${base}${path}`, init);
}

export async function getAgents(): Promise<Response> {
  if (testBaseUrl()) return httpFetch('/api/agents');
  const { GET } = await import('@/app/api/agents/route');
  return GET();
}

export async function postAgent(body: Record<string, unknown>): Promise<Response> {
  if (testBaseUrl()) {
    return httpFetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const { POST } = await import('@/app/api/agents/route');
  return POST(jsonRequest('/api/agents', 'POST', body));
}

export async function getTasks(): Promise<Response> {
  if (testBaseUrl()) return httpFetch('/api/tasks');
  const { NextRequest } = await import('next/server');
  const { GET } = await import('@/app/api/tasks/route');
  return GET(new NextRequest('http://localhost/api/tasks'));
}

export async function patchQueue(body: { id: string; intent?: string; status?: string }): Promise<Response> {
  const intent = body.intent ?? (body.status === 'rejected' ? 'reject' : body.status === 'approved' ? 'approve' : undefined);
  const payload = { id: body.id, intent };
  if (testBaseUrl()) {
    return httpFetch('/api/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  const { PATCH } = await import('@/app/api/queue/route');
  return PATCH(jsonRequest('/api/queue', 'PATCH', payload));
}

export async function postMessage(
  command: string,
  sessionId?: string,
): Promise<{ res: Response; events: HarnessEvent[] }> {
  const payload = JSON.stringify({ command, sessionId });

  const res = testBaseUrl()
    ? await httpFetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
    : await (async () => {
        const { POST } = await import('@/app/api/message/route');
        return POST(jsonRequest('/api/message', 'POST', JSON.parse(payload)));
      })();

  const events = await collectHarnessEvents(res);
  return { res, events };
}

export function findAgentInGroups(
  body: { groups: Array<{ agents: Array<{ id: string; displayName: string; hasCustomization: boolean }> }> },
  agentId: string,
) {
  for (const group of body.groups) {
    const agent = group.agents.find(a => a.id === agentId);
    if (agent) return agent;
  }
  return undefined;
}

export function assertHarnessCompleted(events: HarnessEvent[]): void {
  const types = events.map(e => e.type);
  if (!types.includes('entity_complete')) {
    const agentErr = events.find(e => e.type === 'agent_error');
    const entityErr = events.find(e => e.type === 'entity_error');
    const errMsg = events.find(e => e.type === 'error');
    const detail = [agentErr, entityErr, errMsg]
      .filter(Boolean)
      .map(e => `${e!.type}: ${JSON.stringify(e!.data)}`)
      .join('; ');
    throw new Error(`Expected entity_complete; got: ${types.join(', ')}${detail ? ` (${detail})` : ''}`);
  }
  if (types.includes('entity_error')) {
    const err = events.find(e => e.type === 'entity_error');
    throw new Error(`entity_error: ${JSON.stringify(err?.data)}`);
  }
}
