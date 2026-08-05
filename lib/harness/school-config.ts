import type { ChildProfile, KnowledgeBase } from '@/types/knowledge-base';

export interface SchoolProfile {
  school: string;
  child: string;
  senderDomains?: string[];
  senderPatterns?: string[];
  microsoftSiteId?: string;
  microsoftNewsListId?: string;
  microsoftDocsPath?: string;
}

/** Explicit KB seed — Ivy & Sebastian with school email domains (not inferred from school name). */
export const DEFAULT_SCHOOL_CHILDREN: ChildProfile[] = [
  {
    name: 'Ivy',
    school: 'Genazzano FCJ College',
    senderDomains: ['genazzano.vic.edu.au'],
  },
  {
    name: 'Sebastian',
    school: 'Xavier College',
    senderDomains: ['xavier.vic.edu.au'],
  },
];

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, '');
}

function senderAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

function childToSchoolProfile(child: ChildProfile): SchoolProfile | null {
  const school = child.school?.trim();
  const name = child.name?.trim();
  if (!school || !name) return null;

  const domains = (child.senderDomains ?? [])
    .map(normalizeDomain)
    .filter(Boolean);
  const patterns = (child.senderPatterns ?? [])
    .map(p => p.trim())
    .filter(Boolean);

  return {
    school,
    child: name,
    senderDomains: domains.length > 0 ? domains : undefined,
    senderPatterns: patterns.length > 0 ? patterns : undefined,
    microsoftSiteId: child.microsoftSiteId,
    microsoftNewsListId: child.microsoftNewsListId,
    microsoftDocsPath: child.microsoftDocsPath,
  };
}

function profileMatchesFrom(profile: SchoolProfile, from: string): boolean {
  const header = from.toLowerCase();
  const address = senderAddress(from);
  const domain = address.includes('@') ? address.split('@')[1] : '';

  if (profile.senderDomains?.some(d => domain === d || domain.endsWith(`.${d}`))) {
    return true;
  }

  if (profile.senderPatterns?.some(pattern => {
    try {
      return new RegExp(pattern, 'i').test(header);
    } catch {
      return header.includes(pattern.toLowerCase());
    }
  })) {
    return true;
  }

  return false;
}

function profilesFromChildren(children: ChildProfile[]): SchoolProfile[] {
  return children
    .map(childToSchoolProfile)
    .filter((p): p is SchoolProfile => p != null);
}

/** Runtime fallback when callers have not loaded KB yet (e.g. Gmail exclude during agent tool setup). */
export const DEFAULT_SCHOOL_PROFILES: SchoolProfile[] = profilesFromChildren(DEFAULT_SCHOOL_CHILDREN);

/** Load school profiles from KB children. Pass null/undefined only for legacy callers without KB. */
export function loadSchoolProfiles(kb?: KnowledgeBase | Record<string, unknown> | null): SchoolProfile[] {
  if (kb == null) return [...DEFAULT_SCHOOL_PROFILES];

  const family = (kb as KnowledgeBase).family;
  const children = family?.children ?? [];
  return profilesFromChildren(children);
}

export function schoolFromSender(
  from: string,
  profiles: SchoolProfile[] = loadSchoolProfiles(),
): { school: string; child: string } | null {
  for (const profile of profiles) {
    if (profileMatchesFrom(profile, from)) {
      return { school: profile.school, child: profile.child };
    }
  }
  return null;
}

/** For attribution checks — which child names may appear on emails from each school. */
export function schoolChildAttributionMap(
  profiles: SchoolProfile[] = loadSchoolProfiles(),
): Array<{ match: RegExp; allowedChildren: string[] }> {
  return profiles.map(profile => {
    const parts = [
      ...(profile.senderPatterns ?? []),
      ...(profile.senderDomains ?? []),
      profile.school,
    ].filter(Boolean);
    const source = parts.join('|');
    let match: RegExp;
    try {
      match = new RegExp(source, 'i');
    } catch {
      match = new RegExp(parts[0] ?? profile.school, 'i');
    }
    return {
      match,
      allowedChildren: [profile.child.toLowerCase()],
    };
  });
}

export function allSchoolChildNames(profiles: SchoolProfile[] = loadSchoolProfiles()): string[] {
  return [...new Set(profiles.map(p => p.child.toLowerCase()).filter(Boolean))];
}

/** Gmail `from:(…)` clause for school sender domains/patterns. */
export function buildSchoolGmailFromQuery(profiles: SchoolProfile[] = loadSchoolProfiles()): string {
  const terms = new Set<string>();
  for (const profile of profiles) {
    for (const domain of profile.senderDomains ?? []) {
      terms.add(`@${normalizeDomain(domain)}`);
    }
    for (const pattern of profile.senderPatterns ?? []) {
      if (/^[a-z0-9.-]+$/i.test(pattern)) terms.add(pattern);
    }
  }
  if (terms.size === 0) {
    for (const profile of DEFAULT_SCHOOL_PROFILES) {
      for (const pattern of profile.senderPatterns ?? []) terms.add(pattern);
    }
  }
  const list = [...terms].join(' OR ');
  return list ? `from:(${list})` : '';
}

/** Gmail exclude clause — omit school senders from general inbox triage. */
export function buildSchoolGmailExcludeQuery(profiles: SchoolProfile[] = loadSchoolProfiles()): string {
  const include = buildSchoolGmailFromQuery(profiles);
  return include ? `-${include}` : '';
}
