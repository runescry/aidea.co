'use client';

import { useEffect, useState } from 'react';
import type { FamilyChild, FamilyNeedItem } from '@/lib/harness/family-week';
import { openGmailMessage, prefetchConnectedGmailAccount } from '@/lib/client/open-gmail';
import { childDotClass } from './childColors';

function NeedRow({ item, child }: { item: FamilyNeedItem; child: FamilyChild | undefined }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(item.detail || item.gmailLink || item.gmailUrl);

  return (
    <li className="rounded-xl border border-border border-l-[3px] border-l-danger bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => expandable && setOpen(v => !v)}
        className="w-full flex items-start gap-2.5 text-left px-3.5 py-3"
        aria-expanded={expandable ? open : undefined}
      >
        <span
          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${child ? childDotClass(child.colorIndex) : 'bg-foreground-subtle'}`}
          aria-hidden
        />
        <span className="text-[15px] font-medium text-foreground leading-snug">{item.title}</span>
      </button>
      {expandable && open && (
        <div className="px-3.5 pb-3.5 pl-[34px] space-y-2">
          {item.detail && <p className="text-[13.5px] text-foreground-muted leading-snug">{item.detail}</p>}
          {(item.gmailLink || item.gmailUrl) && (
            <a
              href="#"
              onClick={event => {
                event.preventDefault();
                const link = item.gmailLink ?? { messageId: item.id, from: '', subject: item.title };
                const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
                void openGmailMessage({ id: link.messageId, ...link }, popup);
              }}
              className="inline-block text-[12.5px] font-medium text-accent hover:underline"
            >
              View original email ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export default function NeedsDoingCard({
  items,
  children,
}: {
  items: FamilyNeedItem[];
  children: FamilyChild[];
}) {
  useEffect(() => {
    prefetchConnectedGmailAccount();
  }, []);

  if (items.length === 0) return null;
  const byChild = new Map(children.map(c => [c.key, c]));

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle mb-3">Needs doing</p>
      <ul className="space-y-2">
        {items.map(item => (
          <NeedRow key={item.id} item={item} child={item.childKey ? byChild.get(item.childKey) : undefined} />
        ))}
      </ul>
    </div>
  );
}
