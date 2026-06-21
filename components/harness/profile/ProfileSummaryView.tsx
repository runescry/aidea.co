'use client';

import { useState } from 'react';
import type { JobApplication, KnowledgeBase } from '@/types/knowledge-base';
import {
  PROFILE_DOMAINS,
  domainHasData,
  formatLastTouch,
  getCoolingContacts,
  getCurrentChapter,
  getFeaturedContacts,
  getPrioritizedJobs,
  profileCompletenessPercent,
  profileDisplayName,
  profileSubtitle,
  type ProfileDomain,
} from '@/lib/profile/summary';
import { TextArea } from '../forms';

function CompletenessRing({ percent }: { percent: number }) {
  return (
    <div
      className="flex items-center gap-2 text-[11px] text-foreground-muted"
      title={`${percent}% of profile domains have data`}
    >
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-accent/30 text-[10px] font-semibold text-accent tabular-nums"
        aria-hidden
      >
        {percent}
      </span>
      <span>Profile {percent}% complete</span>
    </div>
  );
}

interface SummaryProps {
  data: KnowledgeBase;
  onEditChapter: (chapter: string) => void;
  onOpenDomain: (domain: ProfileDomain) => void;
  onOpenChat: (draft: string) => void;
}

export default function ProfileSummaryView({
  data,
  onEditChapter,
  onOpenDomain,
  onOpenChat,
}: SummaryProps) {
  const [editingChapter, setEditingChapter] = useState(false);
  const [chapterDraft, setChapterDraft] = useState('');

  const chapter = getCurrentChapter(data);
  const jobs = getPrioritizedJobs(data, 5);
  const featured = getFeaturedContacts(data, 3);
  const cooling = getCoolingContacts(data);
  const completeness = profileCompletenessPercent(data);
  const subtitle = profileSubtitle(data);

  const startChapterEdit = () => {
    setChapterDraft(chapter);
    setEditingChapter(true);
  };

  const saveChapter = () => {
    onEditChapter(chapterDraft.trim());
    setEditingChapter(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{profileDisplayName(data)}</h2>
        {subtitle && <p className="text-sm text-foreground-muted">{subtitle}</p>}
        <CompletenessRing percent={completeness} />
      </header>

      <section className="rounded-xl border border-border bg-surface-subtle/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">Current chapter</h3>
          {!editingChapter && (
            <button type="button" onClick={startChapterEdit} className="text-xs text-accent hover:underline">
              Edit
            </button>
          )}
        </div>
        {editingChapter ? (
          <div className="space-y-2">
            <TextArea
              value={chapterDraft}
              onChange={setChapterDraft}
              rows={4}
              placeholder="What life chapter are you in right now?"
            />
            <div className="flex gap-2">
              <button type="button" onClick={saveChapter} className="px-3 py-1.5 btn-primary text-xs">
                Save chapter
              </button>
              <button type="button" onClick={() => setEditingChapter(false)} className="px-3 py-1.5 btn-secondary text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : chapter ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{chapter}</p>
        ) : (
          <button
            type="button"
            onClick={startChapterEdit}
            className="text-sm text-foreground-muted hover:text-accent text-left"
          >
            Add a short narrative about what you&apos;re focused on right now…
          </button>
        )}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">Priorities</h3>
          <button type="button" onClick={() => onOpenDomain('work')} className="text-xs text-accent hover:underline">
            Edit work →
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No job applications tracked yet.{' '}
            <button type="button" onClick={() => onOpenDomain('work')} className="text-accent hover:underline">
              Add in Work
            </button>
          </p>
        ) : (
          <ol className="space-y-3">
            {jobs.map((job, index) => (
              <PriorityRow key={`${job.company}-${index}`} job={job} rank={index + 1} />
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">People</h3>
          <button type="button" onClick={() => onOpenDomain('contacts')} className="text-xs text-accent hover:underline">
            View all →
          </button>
        </div>
        {cooling.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {cooling.length} contact{cooling.length === 1 ? '' : 's'} may need a check-in
          </p>
        )}
        {featured.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            Add key contacts in{' '}
            <button type="button" onClick={() => onOpenDomain('contacts')} className="text-accent hover:underline">
              People
            </button>
          </p>
        ) : (
          <ul className="space-y-2">
            {featured.map(entry => (
              <li
                key={entry.email ?? entry.name}
                className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                  <p className="text-xs text-foreground-muted truncate">
                    {[entry.company, entry.relationship].filter(Boolean).join(' · ') || 'Contact'}
                  </p>
                </div>
                <span className="text-[11px] text-foreground-subtle shrink-0 tabular-nums">
                  {formatLastTouch(entry.lastTouch)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide px-1">Domains</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROFILE_DOMAINS.map(domain => (
            <button
              key={domain.id}
              type="button"
              onClick={() => onOpenDomain(domain.id)}
              className="text-left rounded-xl border border-border bg-surface hover:bg-surface-subtle/80 px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${domainHasData(data, domain.id) ? 'bg-accent' : 'bg-border'}`}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">{domain.label}</span>
              </div>
              <p className="text-[11px] text-foreground-subtle mt-1 pl-4">{domain.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => onOpenChat('Update my profile: ')}
          className="px-3 py-2 btn-secondary text-xs"
        >
          Update via chat
        </button>
      </footer>
    </div>
  );
}

function PriorityRow({ job, rank }: { job: JobApplication; rank: number }) {
  const title = [job.company, job.role].filter(Boolean).join(' — ') || 'Application';
  const detail = [job.status, job.nextAction].filter(Boolean).join(' · ');
  return (
    <li className="flex gap-3">
      <span className="text-xs font-semibold text-accent tabular-nums w-5 shrink-0 pt-0.5">{rank}.</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {detail && <p className="text-xs text-foreground-muted mt-0.5">{detail}</p>}
      </div>
    </li>
  );
}
