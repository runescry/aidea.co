import type { KnowledgeBase, ProfilePersonStatus } from '@/types/knowledge-base';

export interface JobApplicationPatch {
  company: string;
  role?: string;
  status?: string;
  nextAction?: string;
  priority?: number;
}

export interface PersonPatch {
  id?: string;
  name: string;
  email?: string;
  emails?: string[];
  phones?: string[];
  company?: string;
  relationship?: string;
  notes?: string;
  status?: ProfilePersonStatus;
}

export interface KbPatchInput {
  updates?: Partial<KnowledgeBase>;
  jobApplication?: JobApplicationPatch;
  person?: PersonPatch;
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
  if (input.person) {
    const p = input.person;
    const parts = [p.name];
    if (p.status === 'removed') parts.push('→ removed');
    else if (p.relationship) parts.push(`(${p.relationship})`);
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
  if (raw && (raw.jobApplication?.company || raw.person?.name || raw.updates || raw.key !== undefined)) {
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
  return buildKbUpdatePreview(action).fields.map(f => `${f.label}: ${f.value}`).join('\n')
    || sanitizeQueueSummary(action.summary);
}

export interface KbUpdatePreview {
  headline: string;
  reason?: string;
  fields: Array<{ label: string; value: string }>;
}

export function buildKbUpdatePreview(action: {
  summary: string;
  detail?: string;
  payload?: Record<string, unknown>;
}): KbUpdatePreview {
  const reason = typeof action.payload?.reason === 'string' ? action.payload.reason : action.detail;
  const input = action.payload ? kbPatchInputFromPayload(action.payload) : null;
  const fields: Array<{ label: string; value: string }> = [];

  if (input?.jobApplication) {
    const j = input.jobApplication;
    fields.push({ label: 'Company', value: j.company });
    if (j.role) fields.push({ label: 'Role', value: j.role });
    if (j.status) fields.push({ label: 'Status', value: j.status });
    if (j.nextAction) fields.push({ label: 'Next action', value: j.nextAction });
    return {
      headline: formatKbPatchSummary(input),
      reason,
      fields,
    };
  }

  if (input?.person) {
    const p = input.person;
    fields.push({ label: 'Person', value: p.name });
    if (p.email) fields.push({ label: 'Email', value: p.email });
    if (p.status) fields.push({ label: 'Status', value: p.status });
    if (p.relationship) fields.push({ label: 'Relationship', value: p.relationship });
    return {
      headline: formatKbPatchSummary(input),
      reason,
      fields,
    };
  }

  if (input?.key) {
    fields.push({ label: 'Field', value: input.key });
    if (input.value !== undefined) {
      fields.push({ label: 'Value', value: String(input.value) });
    }
    return {
      headline: formatKbPatchSummary(input),
      reason,
      fields,
    };
  }

  if (input?.updates) {
    for (const key of Object.keys(input.updates)) {
      fields.push({ label: key, value: 'Update pending' });
    }
    return {
      headline: formatKbPatchSummary(input),
      reason,
      fields,
    };
  }

  const patch = action.payload?.patch as Record<string, unknown> | undefined;
  if (patch?.work) fields.push({ label: 'Section', value: 'Work profile' });
  if (patch?.family) fields.push({ label: 'Section', value: 'Family notes' });
  if (patch?.goals) fields.push({ label: 'Section', value: 'Goals' });

  return {
    headline: sanitizeQueueSummary(action.summary),
    reason,
    fields,
  };
}
