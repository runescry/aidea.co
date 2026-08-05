'use client';

import type { FamilyChild, FamilyTodayItem } from '@/lib/harness/family-week';
import { childDotClass } from './childColors';

export default function FamilyTodayCard({
  items,
  children,
}: {
  items: FamilyTodayItem[];
  children: FamilyChild[];
}) {
  const byChild = new Map(children.map(c => [c.key, c]));

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2.5">Today</p>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className="flex items-start gap-2.5 text-[15px] leading-snug text-foreground">
              <span
                className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${
                  item.childKey ? childDotClass(byChild.get(item.childKey)?.colorIndex ?? 0) : 'bg-foreground-subtle'
                }`}
                aria-hidden
              />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-foreground-muted">Nothing flagged for today.</p>
      )}
    </div>
  );
}
