'use client';

import { useState } from 'react';
import type { FamilyChild, FamilyWeekDay } from '@/lib/harness/family-week';
import { childDotClass } from './childColors';

export default function FamilyWeekStrip({
  week,
  children,
}: {
  week: FamilyWeekDay[];
  children: FamilyChild[];
}) {
  const [selected, setSelected] = useState<string | null>(week[0]?.date ?? null);
  const byChild = new Map(children.map(c => [c.key, c]));
  const selectedDay = week.find(d => d.date === selected) ?? week[0] ?? null;

  if (week.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle mb-3">This week</p>
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}
      >
        {week.map(day => {
          const isSelected = day.date === selectedDay?.date;
          return (
            <button
              key={day.date || day.label}
              type="button"
              onClick={() => setSelected(day.date)}
              className={`rounded-xl px-1 py-2.5 text-center transition-colors ${
                isSelected ? 'bg-accent/10' : 'hover:bg-surface-subtle'
              }`}
              aria-pressed={isSelected}
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-foreground-subtle mb-1.5">
                {day.label}
              </div>
              <div className="flex items-center justify-center gap-1 min-h-[8px]">
                {day.childKeys.length > 0 ? (
                  day.childKeys.map(key => (
                    <span
                      key={key}
                      className={`w-1.5 h-1.5 rounded-full ${childDotClass(byChild.get(key)?.colorIndex ?? 0)}`}
                    />
                  ))
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-border" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-4 pt-4 border-t border-border">
          {selectedDay.events.length > 0 ? (
            <ul className="space-y-1.5">
              {selectedDay.events.map((event, i) => {
                const child = event.childKey ? byChild.get(event.childKey) : undefined;
                return (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-foreground-muted leading-snug">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${child ? childDotClass(child.colorIndex) : 'bg-border'}`}
                      aria-hidden
                    />
                    {event.title}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-foreground-subtle">Nothing on the calendar for {selectedDay.label.toLowerCase()}.</p>
          )}
        </div>
      )}
    </div>
  );
}
