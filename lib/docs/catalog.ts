export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  file: string;
}

/** Markdown docs available at /docs/[slug] */
export const DOC_CATALOG: DocEntry[] = [
  {
    slug: 'plan',
    title: 'Gap closure plan',
    description: 'P7 complete; P8 harden & extend — data, workforce, UX, platform',
    file: 'docs/PLAN.md',
  },
  {
    slug: 'vision',
    title: 'Product vision',
    description: 'Vision statement, domains, enrichment scores',
    file: 'docs/VISION.md',
  },
  {
    slug: 'roadmap',
    title: 'Roadmap',
    description: 'Priorities, phases, loop log',
    file: 'ROADMAP.md',
  },
  {
    slug: 'agents',
    title: 'Agent instructions',
    description: 'Implementation guide for contributors',
    file: 'AGENTS.md',
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    description: 'Vercel, Postgres, env vars, ops',
    file: 'docs/DEPLOYMENT.md',
  },
];

export function getDocBySlug(slug: string): DocEntry | undefined {
  return DOC_CATALOG.find(d => d.slug === slug);
}

const BASENAME_TO_SLUG: Record<string, string> = {
  plan: 'plan',
  vision: 'vision',
  roadmap: 'roadmap',
  agents: 'agents',
  deployment: 'deployment',
};

/** Map markdown hrefs to /docs/[slug] for in-app navigation */
export function resolveDocHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (href.startsWith('http') || href.startsWith('/docs') || href.startsWith('#')) return href;

  const basename = href.split('/').pop()?.replace(/\.md$/i, '').toLowerCase();
  if (basename && BASENAME_TO_SLUG[basename]) {
    return `/docs/${BASENAME_TO_SLUG[basename]}`;
  }
  return href;
}

export function slugifyHeading(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** GitHub-style dedup: first slug is base, repeats get `-1`, `-2`, … */
export function nextHeadingId(text: string, seen: Map<string, number>): string {
  const base = slugifyHeading(text);
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

export interface DocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface ParsedDocHeading {
  level: 1 | 2 | 3;
  text: string;
  id: string;
  line: number;
}

/** Single pass over ATX headings (h1–h3), skipping fenced code blocks. */
export function parseDocumentHeadings(markdown: string): ParsedDocHeading[] {
  const headings: ParsedDocHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length as 1 | 2 | 3;
    const text = m[2].replace(/\*\*/g, '').trim();
    headings.push({
      level,
      text,
      id: nextHeadingId(text, seen),
      line: i + 1,
    });
  }
  return headings;
}

export function extractHeadings(markdown: string): DocHeading[] {
  return parseDocumentHeadings(markdown)
    .filter(h => h.level >= 2)
    .map(({ id, text, level }) => ({ id, text, level: level as 2 | 3 }));
}

/** Line number (1-indexed) → anchor id — stable for SSR/hydration via remark node positions. */
export function buildDocumentHeadingIdByLine(markdown: string): Record<string, string> {
  const byLine: Record<string, string> = {};
  for (const h of parseDocumentHeadings(markdown)) {
    byLine[String(h.line)] = h.id;
  }
  return byLine;
}
