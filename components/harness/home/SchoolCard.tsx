'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SchoolFeed, SchoolFeedEmailRow, SchoolFeedRoundup } from '@/types/knowledge-base';
import { decodeBriefText } from '@/lib/harness/morning-brief-must-do';
import SchoolWeekCalendar from './SchoolWeekCalendar';

const PREVIEW_COUNT = 2;

interface EventOutcome {
  ok: boolean;
  title: string;
  date: string;
  time?: string;
  location?: string;
  assumedTime: boolean;
  error?: string;
}

interface UploadResponse {
  ok: boolean;
  events?: EventOutcome[];
  error?: string;
}

function UploadEventControl({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [events, setEvents] = useState<EventOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setEvents(null);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/school-feed/upload', { method: 'POST', body });
      const data = await res.json() as UploadResponse;
      if (data.events) {
        setEvents(data.events);
        if (data.events.some(e => e.ok)) onUploaded();
      } else {
        setError(data.error ?? 'Upload failed');
      }
    } catch {
      setError('Upload failed — check your connection and try again');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onUploaded]);

  return (
    <div className="space-y-1">
      <label className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-border cursor-pointer transition-colors">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={uploading}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {uploading ? 'Reading document…' : 'Upload flyer or form'}
      </label>
      {events && events.map((event, i) => (
        <p key={i} className={`text-[11px] ${event.ok ? 'text-foreground-muted' : 'text-danger'}`}>
          {event.ok ? 'Added' : 'Could not add'} &ldquo;{event.title}&rdquo; on {event.date}
          {event.time ? ` at ${event.time}` : ''}
          {event.ok && event.assumedTime ? ' (no time found — assumed 9am)' : ''}
          {!event.ok && event.error ? ` — ${event.error}` : ''}
        </p>
      ))}
      {error && (
        <p className="text-[11px] text-danger">{error}</p>
      )}
    </div>
  );
}

function uniqueBySubject(rows: SchoolFeedEmailRow[]): SchoolFeedEmailRow[] {
  const seen = new Map<string, SchoolFeedEmailRow>();
  for (const row of rows) {
    const key = row.subject.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

function SchoolEmailRow({
  row,
  showMeta = false,
}: {
  row: SchoolFeedEmailRow;
  showMeta?: boolean;
}) {
  const subject = decodeBriefText(row.subject);
  return (
    <li className="text-xs leading-snug">
      {row.gmailUrl ? (
        <a href={row.gmailUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline line-clamp-2">
          {subject}
        </a>
      ) : (
        <div className="font-medium text-foreground line-clamp-2">{subject}</div>
      )}
      {showMeta && (
        <div className="text-foreground-muted">{row.school} · {row.child}</div>
      )}
      {row.deadline && (
        <div className="text-foreground-subtle">Due {row.deadline}</div>
      )}
    </li>
  );
}

function FyiSection({ rows, title = 'FYI' }: { rows: SchoolFeedEmailRow[]; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const unique = uniqueBySubject(rows);
  const visible = expanded ? unique : unique.slice(0, PREVIEW_COUNT);
  const hidden = unique.length - visible.length;

  return (
    <div>
      <div className="text-[11px] font-medium text-foreground-muted mb-1">{title}</div>
      <ul className="space-y-1">
        {visible.map(row => (
          <SchoolEmailRow key={row.messageId} row={row} showMeta />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-[10px] text-accent hover:underline mt-0.5"
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function SchoolRoundupBlock({ roundup }: { roundup: SchoolFeedRoundup }) {
  const [expandedNeedsYou, setExpandedNeedsYou] = useState(false);
  const [expandedFyi, setExpandedFyi] = useState(false);
  const needsYou = uniqueBySubject(roundup.needsYou);
  const fyi = uniqueBySubject(roundup.fyi);
  const visibleNeedsYou = expandedNeedsYou ? needsYou : needsYou.slice(0, PREVIEW_COUNT);
  const hiddenNeedsYou = needsYou.length - visibleNeedsYou.length;
  const visibleFyi = expandedFyi ? fyi : fyi.slice(0, PREVIEW_COUNT);
  const hiddenFyi = fyi.length - visibleFyi.length;

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-foreground">
        {roundup.child}
        <span className="text-foreground-subtle font-normal"> · {roundup.school}</span>
        <span className="text-foreground-subtle font-normal"> — {roundup.emailCount} emails</span>
      </div>

      {needsYou.length > 0 && (
        <div className="mt-0.5">
          <div className="text-[10px] font-medium text-foreground-muted mb-0.5">Needs you</div>
          <ul className="space-y-1">
            {visibleNeedsYou.map(row => (
              <SchoolEmailRow key={row.messageId} row={row} />
            ))}
          </ul>
          {hiddenNeedsYou > 0 && (
            <button
              type="button"
              onClick={() => setExpandedNeedsYou(e => !e)}
              className="text-[10px] text-accent hover:underline mt-0.5"
            >
              {expandedNeedsYou ? 'Show less' : `Show ${hiddenNeedsYou} more`}
            </button>
          )}
        </div>
      )}

      {fyi.length > 0 && (
        <div className="mt-1">
          {(needsYou.length === 0 || expandedFyi) ? (
            <>
              <div className="text-[10px] font-medium text-foreground-muted mb-0.5">FYI</div>
              <ul className="space-y-1">
                {visibleFyi.map(row => (
                  <SchoolEmailRow key={row.messageId} row={row} />
                ))}
              </ul>
              {hiddenFyi > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedFyi(e => !e)}
                  className="text-[10px] text-accent hover:underline mt-0.5"
                >
                  {expandedFyi ? 'Show less' : `Show ${hiddenFyi} more`}
                </button>
              )}
              {needsYou.length > 0 && expandedFyi && (
                <button
                  type="button"
                  onClick={() => setExpandedFyi(false)}
                  className="text-[10px] text-foreground-subtle hover:underline mt-0.5"
                >
                  Hide FYI
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setExpandedFyi(true)}
              className="text-[10px] text-accent hover:underline"
            >
              Show {fyi.length} FYI
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchoolCard({
  hideTitle = false,
  refreshKey = 0,
  syncError = null,
  showCalendar = false,
}: {
  hideTitle?: boolean;
  refreshKey?: number;
  syncError?: string | null;
  /** Calendar lives in the right aside on desktop; keep false for the main school column. */
  showCalendar?: boolean;
}) {
  const [feed, setFeed] = useState<SchoolFeed | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const res = await fetch('/api/school-feed');
      if (!res.ok || signal?.cancelled) return;
      const data = await res.json() as { feed: SchoolFeed | null };
      setFeed(data.feed);
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    setLoading(true);
    void loadFeed(signal);
    return () => { signal.cancelled = true; };
  }, [refreshKey, loadFeed]);

  if (loading) {
    return (
      <p className="text-[12px] text-foreground-muted py-2">Loading school updates…</p>
    );
  }

  const roundups = feed?.gmail.roundups ?? [];
  const gmailAction = feed?.gmail.actionRequired ?? [];
  const gmailFyi = feed?.gmail.fyi ?? [];
  const calendarEvents = feed?.calendar?.events ?? [];
  const news = feed?.sharepoint?.news ?? [];
  const docs = feed?.sharepoint?.documents ?? [];
  const hasEmailContent = roundups.length + gmailAction.length + gmailFyi.length + news.length + docs.length > 0;
  const hasCalendarContent = showCalendar && calendarEvents.length > 0;
  const hasContent = hasEmailContent || hasCalendarContent;

  if (!hasContent) {
    return (
      <div className="py-2 space-y-2">
        {syncError && (
          <p className="text-[12px] text-danger">{syncError}</p>
        )}
        <p className="text-[12px] text-foreground-muted">
          {syncError
            ? 'Fix the issue above, then sync again.'
            : showCalendar
              ? 'No school events this week. Tap Sync now on the left.'
              : 'No school emails in the last 14 days. Tap Sync now to check Gmail.'}
        </p>
        <UploadEventControl onUploaded={() => void loadFeed()} />
      </div>
    );
  }

  return (
    <section className="card p-3 space-y-2.5">
      {syncError && (
        <p className="text-[12px] text-danger">{syncError}</p>
      )}
      {feed?.updatedAt && (
        <div className={`flex ${hideTitle ? 'justify-end' : 'items-center justify-between gap-2'}`}>
          {!hideTitle && (
            <h3 className="text-[13px] font-semibold text-foreground">School</h3>
          )}
          <span className="text-[10px] text-foreground-subtle shrink-0">
            Updated {new Date(feed.updatedAt).toLocaleString()}
          </span>
        </div>
      )}
      {!hideTitle && !feed?.updatedAt && (
        <h3 className="text-[13px] font-semibold text-foreground">School</h3>
      )}

      {hasCalendarContent && feed?.calendar && (
        <SchoolWeekCalendar calendar={feed.calendar} />
      )}

      <UploadEventControl onUploaded={() => void loadFeed()} />

      {roundups.length > 0 && (
        <div className="space-y-2.5 divide-y divide-border/60">
          {roundups.map(roundup => (
            <div key={`${roundup.school}:${roundup.child}`} className="first:pt-0 pt-2.5 first:border-0">
              <SchoolRoundupBlock roundup={roundup} />
            </div>
          ))}
        </div>
      )}

      {gmailAction.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-danger mb-1">Needs action</div>
          <ul className="space-y-1">
            {uniqueBySubject(gmailAction).slice(0, 5).map(row => (
              <SchoolEmailRow key={row.messageId} row={row} showMeta />
            ))}
          </ul>
        </div>
      )}

      {roundups.length === 0 && gmailFyi.length > 0 && (
        <FyiSection rows={gmailFyi} />
      )}

      {news.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-foreground-muted mb-1">SharePoint news</div>
          <ul className="space-y-1">
            {news.slice(0, 3).map((item, i) => (
              <li key={`${item.url}-${i}`} className="text-xs">
                <a href={item.url} target="_blank" rel="noreferrer" className="text-accent hover:underline line-clamp-2">
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
            {docs.slice(0, 3).map((doc, i) => (
              <li key={`${doc.url}-${i}`} className="text-xs">
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-accent hover:underline line-clamp-2">
                  {doc.name}{doc.child ? ` (${doc.child})` : ''}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
