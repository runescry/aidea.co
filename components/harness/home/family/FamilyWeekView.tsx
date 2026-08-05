'use client';

import { useMemo, useState } from 'react';
import type { FamilyWeekView as FamilyWeekViewData } from '@/lib/harness/family-week';
import { childDotClass } from './childColors';
import FamilyTodayCard from './FamilyTodayCard';
import FamilyWeekStrip from './FamilyWeekStrip';
import NeedsDoingCard from './NeedsDoingCard';
import GoodToKnowCard from './GoodToKnowCard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function FamilyWeekView({
  view,
  dateLabel,
  onManage,
}: {
  view: FamilyWeekViewData;
  dateLabel: string;
  onManage: () => void;
}) {
  const [activeChild, setActiveChild] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const match = <T extends { childKey?: string }>(items: T[]) =>
      activeChild ? items.filter(i => i.childKey === activeChild) : items;
    return {
      today: match(view.today),
      needsDoing: match(view.needsDoing),
      goodToKnow: match(view.goodToKnow),
    };
  }, [view, activeChild]);

  const activeChildName = view.children.find(c => c.key === activeChild)?.name;
  const remaining = filtered.needsDoing.length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-[1040px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-[26px] sm:text-[28px] font-semibold text-foreground tracking-tight">
              {greeting()}
            </h1>
            <p className="text-[14px] text-foreground-muted mt-0.5">{dateLabel}</p>
          </div>
          <button
            type="button"
            onClick={onManage}
            className="shrink-0 text-[12.5px] text-foreground-subtle hover:text-foreground-muted mt-1.5"
          >
            Manage
          </button>
        </div>

        {view.children.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveChild(null)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                activeChild === null ? 'bg-foreground text-surface' : 'bg-surface border border-border text-foreground-muted'
              }`}
            >
              Everyone
            </button>
            {view.children.map(child => (
              <button
                key={child.key}
                type="button"
                onClick={() => setActiveChild(child.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                  activeChild === child.key
                    ? 'bg-foreground text-surface'
                    : 'bg-surface border border-border text-foreground-muted'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${childDotClass(child.colorIndex)}`} aria-hidden />
                {child.name}
              </button>
            ))}
          </div>
        )}

        <div className="inline-flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-[12.5px] font-semibold text-foreground mt-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
          {remaining} thing{remaining === 1 ? '' : 's'} to sort{activeChildName ? ` for ${activeChildName}` : ' this week'}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] lg:grid-rows-2 gap-4">
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
            <FamilyTodayCard items={filtered.today} children={view.children} />
          </div>
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1">
            <FamilyWeekStrip week={view.week} children={view.children} />
          </div>
          <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
            <NeedsDoingCard items={filtered.needsDoing} children={view.children} />
          </div>
          <div className="order-4 lg:order-none lg:col-start-2 lg:row-start-2">
            <GoodToKnowCard items={filtered.goodToKnow} children={view.children} />
          </div>
        </div>

        <button
          type="button"
          onClick={onManage}
          className="block w-full text-center mt-6 py-2 text-[13px] text-foreground-subtle hover:text-foreground-muted"
        >
          Chat, approvals &amp; settings →
        </button>
      </div>
    </div>
  );
}
