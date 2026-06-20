import type { KnowledgeBase } from '@/types/knowledge-base';

export interface JobApplicationPatch {
  company: string;
  role?: string;
  status?: string;
  nextAction?: string;
  priority?: number;
}

export interface KbPatchInput {
  updates?: Partial<KnowledgeBase>;
  jobApplication?: JobApplicationPatch;
  key?: string;
  value?: unknown;
  summary?: string;
}

function parseJobApplicationJson(raw: string): JobApplicationPatch | null {
  try {
    const parsed = JSON.parse(raw) as JobApplicationPatch;
    return parsed.company ? parsed : null;
  } catch {
    return null;
  }
}

function extractJobApplicationFromText(text: string): JobApplicationPatch | null {
  if (!text.trim()) return null;

  const paramMatch = text.match(
    /<parameter\s+name=["']jobApplication["']>\s*(\{[\s\S]*?\})\s*(?:<\/parameter>)?/i,
  );
  if (paramMatch) {
    const parsed = parseJobApplicationJson(paramMatch[1]);
    if (parsed) return parsed;
  }

  const jsonMatch = text.match(/\{[\s\S]*"company"[\s\S]*?\}/);
  if (jsonMatch) {
    return parseJobApplicationJson(jsonMatch[0]);
  }

  return null;
}

/** Recover structured fields when the model leaks JSON into summary text. */
export function normalizeKbPatchInput(input: KbPatchInput): KbPatchInput {
  if (input.jobApplication?.company || input.updates || input.key !== undefined) {
    return input;
  }

  const fromText = extractJobApplicationFromText(input.summary ?? '');
  if (fromText) {
    return { ...input, jobApplication: fromText };
  }

  return input;
}

export function formatKbPatchSummary(input: KbPatchInput): string {
  if (input.jobApplication) {
    const j = input.jobApplication;
    const parts = [j.company];
    if (j.status) parts.push(`→ ${j.status}`);
    if (j.nextAction) parts.push(`(${j.nextAction})`);
    return parts.join(' ');
  }
  if (input.key) return `Set ${input.key}`;
  if (input.updates) return `Update ${Object.keys(input.updates).join(', ')}`;
  return 'Profile update';
}

/** Strip tool-call leaks and JSON blobs from agent-written queue summaries. */
export function sanitizeQueueSummary(summary: string): string {
  const trimmed = summary.trim();
  if (!trimmed) return 'Profile update';

  const normalized = normalizeKbPatchInput({ summary: trimmed });
  if (normalized.jobApplication?.company) {
    return formatKbPatchSummary(normalized);
  }

  let cleaned = trimmed
    .replace(/<parameter[^>]*>[\s\S]*?(?:<\/parameter>|$)/gi, '')
    .replace(/\{[\s\S]*"company"[\s\S]*?\}/g, '')
    .replace(/^["']+|["']+$/g, '')
    .replace(/["'],\s*$/g, '')
    .trim();

  if (!cleaned) return 'Profile update';
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
}

export function kbPatchInputFromPayload(payload: Record<string, unknown>): KbPatchInput | null {
  const raw = payload.input as KbPatchInput | undefined;
  if (raw && (raw.jobApplication?.company || raw.updates || raw.key !== undefined)) {
    return normalizeKbPatchInput(raw);
  }

  if (typeof payload.summary === 'string') {
    const fromSummary = normalizeKbPatchInput({ summary: payload.summary });
    if (fromSummary.jobApplication?.company || fromSummary.updates || fromSummary.key !== undefined) {
      return fromSummary;
    }
  }

  const patch = payload.patch as Record<string, unknown> | undefined;
  if (patch && typeof patch._dotKey === 'string') {
    return { key: patch._dotKey, value: patch._dotValue };
  }

  return null;
}

export function describeKbUpdate(action: {
  summary: string;
  detail?: string;
  payload?: Record<string, unknown>;
}): string {
  const input = action.payload ? kbPatchInputFromPayload(action.payload) : null;
  if (input?.jobApplication) {
    const j = input.jobApplication;
    const lines = [`Update tracked application: ${j.company}`];
    if (j.role) lines.push(`Role: ${j.role}`);
    if (j.status) lines.push(`Status: ${j.status}`);
    if (j.nextAction) lines.push(`Next action: ${j.nextAction}`);
    return lines.join('\n');
  }

  const patch = action.payload?.patch as Record<string, unknown> | undefined;
  if (patch?.work) return 'Update work profile from inbox triage';
  if (patch?.family) return 'Update family notes from inbox triage';
  if (patch?.goals) return 'Update goals from inbox triage';

  return sanitizeQueueSummary(action.summary);
}
