import { AGENT_LIBRARY } from './library';

/** Entity bootstrap keys — not tied to a single agent stateWriteKey. */
const ENTITY_ARTIFACT_LABELS: Record<string, string> = {
  company_identity: 'Company Identity',
  ceo_directive: 'CEO Directive (Cycle 1)',
  ceo_directive_cycle2: 'CEO Directive (Cycle 2)',
  life_context: 'Life Context',
};

export function getArtifactLabel(key: string): string {
  const entityLabel = ENTITY_ARTIFACT_LABELS[key];
  if (entityLabel) return entityLabel;

  for (const def of Object.values(AGENT_LIBRARY)) {
    if (def.stateWriteKey === key) return def.displayName;
  }

  return key
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getKnownArtifactKeys(): string[] {
  const keys = new Set<string>([
    ...Object.keys(ENTITY_ARTIFACT_LABELS),
    ...Object.values(AGENT_LIBRARY).map(def => def.stateWriteKey),
  ]);
  return [...keys];
}

export function sortArtifactKeys(keys: string[]): string[] {
  const preferred = getKnownArtifactKeys();
  const rank = new Map(preferred.map((key, index) => [key, index]));
  return [...keys].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
