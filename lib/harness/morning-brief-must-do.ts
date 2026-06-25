import { schoolFromSender } from './school-roundup';

export function nonEmpty(...parts: unknown[]): string {
  for (const part of parts) {
    const value = String(part ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function snippetHeadline(text: string, max = 100): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = clean.split(/[.!?\n]/)[0]?.trim() ?? clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

export function normalizeMustDoItem(item: Record<string, unknown>): Record<string, unknown> {
  const snippet = nonEmpty(item.snippet, item.detail);
  const subject = nonEmpty(item.subject);
  const action = nonEmpty(
    item.action,
    item.nextStep,
    subject,
    snippetHeadline(snippet),
  );
  const fromField = nonEmpty(item.from);
  const existingContext = nonEmpty(item.context);
  const school = schoolFromSender(`${fromField} ${existingContext}`);
  const context = nonEmpty(
    existingContext,
    school ? `${school.school} · ${school.child}` : '',
    fromField,
  );
  const detailRaw = nonEmpty(item.detail, item.snippet);
  const detail = detailRaw && detailRaw !== action ? detailRaw : undefined;
  return { ...item, action, context, detail };
}

const VAGUE_SUMMARY = /\b(one|several|\d+)\s+(school|email)/i;

/** Drop unlinked agent summaries, dedupe by messageId, fix empty actions. */
export function finalizeMustDoList(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const normalized = items
    .map(normalizeMustDoItem)
    .filter(item => nonEmpty(item.action));

  const linked = normalized.filter(
    item => nonEmpty(item.messageId) || nonEmpty(item.gmailUrl) || item.source === 'school',
  );
  const candidates = linked.length > 0 ? linked : normalized;

  const seen = new Set<string>();
  const deduped = candidates.filter(item => {
    const id = nonEmpty(item.messageId);
    if (!id) {
      if (linked.length > 0 && VAGUE_SUMMARY.test(String(item.action))) return false;
      return true;
    }
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return deduped.slice(0, 8).map((item, i) => ({ ...item, priority: i + 1 }));
}

export function normalizeMorningBrief(brief: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(brief.mustDo)) return brief;
  return {
    ...brief,
    mustDo: finalizeMustDoList(brief.mustDo as Record<string, unknown>[]),
  };
}
