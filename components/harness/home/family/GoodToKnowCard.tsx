'use client';

import { useState } from 'react';
import type { FamilyChild, FamilyGoodToKnowItem } from '@/lib/harness/family-week';
import { childDotClass } from './childColors';

export default function GoodToKnowCard({
  items,
  children,
}: {
  items: FamilyGoodToKnowItem[];
  children: FamilyChild[];
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const byChild = new Map(children.map(c => [c.key, c]));

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
          Good to know ({items.length})
        </span>
        <span className={`text-[11px] text-foreground-subtle transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {items.map(item => {
            const child = item.childKey ? byChild.get(item.childKey) : undefined;
            return (
              <li key={item.id} className="flex items-start gap-2.5 text-[14px] text-foreground-muted leading-snug">
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${child ? childDotClass(child.colorIndex) : 'bg-border'}`}
                  aria-hidden
                />
                {item.title}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
