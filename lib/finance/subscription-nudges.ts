import type { KnowledgeBase } from '@/types/knowledge-base';
import type { TaskItem } from '@/lib/harness/tasks';

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function daysUntil(isoDate: string, now: Date): number | null {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function financeSubscriptionNudges(kb: KnowledgeBase, now = new Date()): TaskItem[] {
  const subs = kb.finance?.subscriptions ?? [];
  const tasks: TaskItem[] = [];

  for (const sub of subs) {
    if (!sub.name?.trim()) continue;
    const renewsOn = sub.renewsOn?.trim();
    if (renewsOn) {
      const days = daysUntil(renewsOn, now);
      if (days == null || days > 7 || days < 0) continue;
      tasks.push({
        id: `proactive-finance-renew-${slug(sub.name)}`,
        source: 'proactive',
        status: 'suggestion',
        title: `${sub.name} renews in ${days} day${days === 1 ? '' : 's'}`,
        subtitle: sub.amount != null
          ? `Finance · ${sub.cadence ?? 'subscription'} · $${sub.amount}`
          : `Finance · ${sub.cadence ?? 'subscription'}`,
        createdAt: now.toISOString(),
        finance: { name: sub.name, renewsOn, amount: sub.amount, cadence: sub.cadence },
      });
      continue;
    }

    if (sub.notes?.toLowerCase().includes('review') || sub.notes?.toLowerCase().includes('cancel')) {
      tasks.push({
        id: `proactive-finance-review-${slug(sub.name)}`,
        source: 'proactive',
        status: 'suggestion',
        title: `Review ${sub.name} subscription`,
        subtitle: sub.notes,
        createdAt: now.toISOString(),
        finance: { name: sub.name, amount: sub.amount, cadence: sub.cadence },
      });
    }
  }

  return tasks;
}
