'use client';

import { useEffect, useState } from 'react';
import type { SchoolFeed } from '@/types/knowledge-base';

export default function SchoolCard() {
  const [feed, setFeed] = useState<SchoolFeed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/school-feed');
        if (!res.ok) return;
        const data = await res.json() as { feed: SchoolFeed | null };
        if (!cancelled) setFeed(data.feed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  const gmailAction = feed?.gmail.actionRequired ?? [];
  const gmailFyi = feed?.gmail.fyi ?? [];
  const news = feed?.sharepoint?.news ?? [];
  const docs = feed?.sharepoint?.documents ?? [];
  const hasContent = gmailAction.length + gmailFyi.length + news.length + docs.length > 0;

  if (!hasContent) return null;

  return (
    <section className="card p-3 space-y-3 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">School</h3>
        {feed?.updatedAt && (
          <span className="text-[10px] text-foreground-subtle">
            Updated {new Date(feed.updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {gmailAction.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-danger mb-1">Needs action</div>
          <ul className="space-y-1.5">
            {gmailAction.map(row => (
              <li key={row.messageId} className="text-xs">
                <div className="font-medium text-foreground">{row.subject}</div>
                <div className="text-foreground-muted">{row.school} · {row.child}</div>
                {row.gmailUrl && (
                  <a href={row.gmailUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Open in Gmail
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {news.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-foreground-muted mb-1">SharePoint news</div>
          <ul className="space-y-1">
            {news.slice(0, 5).map((item, i) => (
              <li key={`${item.url}-${i}`} className="text-xs">
                <a href={item.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {docs.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-foreground-muted mb-1">Documents</div>
          <ul className="space-y-1">
            {docs.slice(0, 5).map((doc, i) => (
              <li key={`${doc.url}-${i}`} className="text-xs">
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {doc.name}{doc.child ? ` (${doc.child})` : ''}
                </a>
                {doc.excerpt && (
                  <div className="text-foreground-subtle line-clamp-2 mt-0.5">{doc.excerpt}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
