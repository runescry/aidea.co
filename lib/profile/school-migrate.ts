import type { ChildProfile, KnowledgeBase } from '@/types/knowledge-base';
import { DEFAULT_SCHOOL_CHILDREN } from '@/lib/harness/school-config';

function cloneChildren(children: ChildProfile[]): ChildProfile[] {
  return children.map(c => ({
    ...c,
    senderDomains: c.senderDomains ? [...c.senderDomains] : undefined,
    senderPatterns: c.senderPatterns ? [...c.senderPatterns] : undefined,
    peDay: c.peDay ? [...c.peDay] : undefined,
  }));
}

function childNeedsSenderConfig(child: ChildProfile): boolean {
  const domains = (child.senderDomains ?? []).filter(Boolean);
  const patterns = (child.senderPatterns ?? []).filter(Boolean);
  return domains.length === 0 && patterns.length === 0;
}

function mergeDefaultSenderConfig(child: ChildProfile): ChildProfile {
  const match = DEFAULT_SCHOOL_CHILDREN.find(
    d => d.name?.trim().toLowerCase() === child.name?.trim().toLowerCase(),
  );
  if (!match) return child;
  return {
    ...child,
    senderDomains: child.senderDomains?.length ? child.senderDomains : match.senderDomains,
    senderPatterns: child.senderPatterns?.length ? child.senderPatterns : match.senderPatterns,
  };
}

/** Idempotent backfill — seeds school children with explicit sender domains when missing. */
export function ensureSchoolChildrenConfigured(kb: KnowledgeBase): KnowledgeBase {
  const children = kb.family?.children ?? [];

  if (children.length === 0) {
    return {
      ...kb,
      family: {
        ...(kb.family ?? {}),
        children: cloneChildren(DEFAULT_SCHOOL_CHILDREN),
      },
    };
  }

  let changed = false;
  const next = children.map(child => {
    if (!childNeedsSenderConfig(child)) return child;
    const merged = mergeDefaultSenderConfig(child);
    const domainsChanged = (merged.senderDomains ?? []).join(',') !== (child.senderDomains ?? []).join(',');
    const patternsChanged = (merged.senderPatterns ?? []).join(',') !== (child.senderPatterns ?? []).join(',');
    if (domainsChanged || patternsChanged) changed = true;
    return merged;
  });

  if (!changed) return kb;
  return {
    ...kb,
    family: { ...(kb.family ?? {}), children: next },
  };
}
