import { describe, expect, it } from 'vitest';
import {
  buildDocumentHeadingIdByLine,
  extractHeadings,
  nextHeadingId,
  parseDocumentHeadings,
} from './catalog';

describe('nextHeadingId', () => {
  it('dedupes repeated heading text', () => {
    const seen = new Map<string, number>();
    expect(nextHeadingId('Exists today', seen)).toBe('exists-today');
    expect(nextHeadingId('Exists today', seen)).toBe('exists-today-1');
    expect(nextHeadingId('Exists today', seen)).toBe('exists-today-2');
  });
});

describe('extractHeadings', () => {
  it('assigns unique ids for duplicate h3 titles', () => {
    const md = `## Layer 1
### Exists today
## Layer 2
### Exists today
### Missing or thin
## Layer 3
### Exists today
`;
    const headings = extractHeadings(md);
    const ids = headings.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'layer-1',
      'exists-today',
      'layer-2',
      'exists-today-1',
      'missing-or-thin',
      'layer-3',
      'exists-today-2',
    ]);
  });

  it('ignores ATX lines inside fenced code blocks', () => {
    const md = `# Title
\`\`\`md
# Not a heading
\`\`\`
## Real section
`;
    const parsed = parseDocumentHeadings(md);
    expect(parsed.map(h => h.text)).toEqual(['Title', 'Real section']);
  });
});

describe('buildDocumentHeadingIdByLine', () => {
  it('maps source line numbers to anchor ids', () => {
    const md = `# Title
## Layer 1
### Exists today
## Layer 2
### Exists today
`;
    const byLine = buildDocumentHeadingIdByLine(md);
    expect(byLine['1']).toBe('title');
    expect(byLine['2']).toBe('layer-1');
    expect(byLine['3']).toBe('exists-today');
    expect(byLine['4']).toBe('layer-2');
    expect(byLine['5']).toBe('exists-today-1');
  });
});
