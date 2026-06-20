import { readAllKB, writeManyKB, writeKB } from './knowledge-base';
import { readDomainAutonomy } from './domain-autonomy';
import type { CurrentProjects, JobApplication, KnowledgeBase } from '@/types/knowledge-base';
import {
  formatKbPatchSummary,
  kbPatchInputFromPayload,
  normalizeKbPatchInput,
  sanitizeQueueSummary,
  type JobApplicationPatch,
  type KbPatchInput,
} from './kb-update-display';

export type { JobApplicationPatch, KbPatchInput };
export {
  describeKbUpdate,
  formatKbPatchSummary,
  kbPatchInputFromPayload,
  normalizeKbPatchInput,
  sanitizeQueueSummary,
} from './kb-update-display';

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
  return readDomainAutonomy(kb).kb ?? 'semi-autonomous';
}

export function shouldAutoApplyKb(
  autonomy: 'supervised' | 'semi-autonomous' | 'autonomous',
  requireApproval?: boolean
): boolean {
  if (requireApproval) return false;
  return autonomy === 'autonomous';
}
