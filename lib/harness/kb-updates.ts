import { readAllKB, writeManyKB, writeKB } from './knowledge-base';
import type { CurrentProjects, JobApplication, KnowledgeBase } from '@/types/knowledge-base';

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

/** Recover structured fields when the model leaks JSON into summary text. */
export function normalizeKbPatchInput(input: KbPatchInput): KbPatchInput {
  if (input.jobApplication?.company || input.updates || input.key !== undefined) {
    return input;
  }

  const text = input.summary ?? '';
  const jsonMatch = text.match(/\{[\s\S]*"company"[\s\S]*?\}/);
  if (!jsonMatch) return input;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as JobApplicationPatch;
    if (parsed.company) {
      return { ...input, jobApplication: parsed };
    }
  } catch {
    // ignore malformed JSON in summary
  }

  return input;
}

export async function buildKbPatch(input: KbPatchInput): Promise<Record<string, unknown>> {
  input = normalizeKbPatchInput(input);
  if (input.key !== undefined) {
    return { _dotKey: input.key, _dotValue: input.value };
  }

  const patch: Record<string, unknown> = { ...(input.updates ?? {}) };

  if (input.jobApplication) {
    const kb = await readAllKB();
    const work = (kb.work ?? {}) as NonNullable<KnowledgeBase['work']>;
    const updated = mergeJobApplication(work.currentProjects, input.jobApplication);
    patch.work = { ...work, ...(patch.work as object ?? {}), currentProjects: updated };
  }

  return patch;
}

function mergeJobApplication(
  projects: CurrentProjects | undefined,
  patch: JobApplicationPatch
): CurrentProjects {
  const companyLower = patch.company.toLowerCase();

  if (!projects || Array.isArray(projects)) {
    return {
      jobApplications: [{
        company: patch.company,
        role: patch.role,
        status: patch.status,
        nextAction: patch.nextAction,
        priority: patch.priority,
      }],
      personalBuilds: [],
    };
  }

  const jobs = [...(projects.jobApplications ?? [])];
  const idx = jobs.findIndex(j => j.company?.toLowerCase() === companyLower);

  if (idx === -1) {
    jobs.push({
      company: patch.company,
      role: patch.role,
      status: patch.status ?? 'Active',
      nextAction: patch.nextAction,
      priority: patch.priority ?? jobs.length + 1,
    });
  } else {
    jobs[idx] = {
      ...jobs[idx],
      ...(patch.role ? { role: patch.role } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.nextAction ? { nextAction: patch.nextAction } : {}),
      ...(patch.priority != null ? { priority: patch.priority } : {}),
    };
  }

  return { ...projects, jobApplications: jobs };
}

export function kbPatchInputFromPayload(payload: Record<string, unknown>): KbPatchInput | null {
  const raw = payload.input as KbPatchInput | undefined;
  if (raw && (raw.jobApplication?.company || raw.updates || raw.key !== undefined)) {
    return normalizeKbPatchInput(raw);
  }
  const patch = payload.patch as Record<string, unknown> | undefined;
  if (patch && Object.keys(patch).length > 0) return patch as KbPatchInput;
  if (typeof payload.summary === 'string') {
    return normalizeKbPatchInput({ summary: payload.summary });
  }
  return null;
}

export async function applyKbPatch(input: KbPatchInput | Record<string, unknown>): Promise<void> {
  const normalized = 'summary' in input && !('jobApplication' in input && (input as KbPatchInput).jobApplication)
    ? normalizeKbPatchInput(input as KbPatchInput)
    : (input as KbPatchInput);

  const patch = '_dotKey' in normalized || normalized.jobApplication || normalized.updates || normalized.key !== undefined
    ? await buildKbPatch(normalized)
    : (normalized as Record<string, unknown>);

  if (typeof patch._dotKey === 'string') {
    await writeKB(patch._dotKey, patch._dotValue);
    return;
  }

  if (Object.keys(patch).length > 0) {
    await writeManyKB(patch);
  }
}

export async function getKbAutonomy(): Promise<'supervised' | 'semi-autonomous' | 'autonomous'> {
  const kb = await readAllKB() as KnowledgeBase;
  return kb.preferences?.defaultAutonomyLevel ?? 'semi-autonomous';
}

export function shouldAutoApplyKb(
  autonomy: 'supervised' | 'semi-autonomous' | 'autonomous',
  requireApproval?: boolean
): boolean {
  if (requireApproval) return false;
  return autonomy === 'autonomous';
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
