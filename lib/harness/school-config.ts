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

/** Legacy fallback when KB has no per-child sender config. */
export const DEFAULT_SCHOOL_PROFILES: SchoolProfile[] = [
  {
    school: 'Genazzano',
    child: 'Ivy',
    senderDomains: ['genazzano.vic.edu.au'],
    senderPatterns: ['genazzano'],
  },
  {
    school: 'Xavier College',
    child: 'Sebastian',
    senderPatterns: ['xavier'],
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

  if (domains.length === 0 && patterns.length === 0) {
    const guess = school.split(/\s+/)[0]?.toLowerCase();
    if (guess && guess.length >= 3) {
      patterns.push(guess);
    }
  }

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

/** Load school profiles from KB children, falling back to defaults when none configured. */
export function loadSchoolProfiles(kb?: KnowledgeBase | Record<string, unknown> | null): SchoolProfile[] {
  const family = kb && typeof kb === 'object' ? (kb as KnowledgeBase).family : undefined;
  const children = family?.children ?? [];
  const fromKb = children
    .map(childToSchoolProfile)
    .filter((p): p is SchoolProfile => p != null);

  if (fromKb.length === 0) return [...DEFAULT_SCHOOL_PROFILES];
  return fromKb;
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
