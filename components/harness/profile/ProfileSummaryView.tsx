'use client';

import { useState, useEffect } from 'react';
import type { JobApplication, KnowledgeBase, ProfilePerson, ProfilePersonStatus } from '@/types/knowledge-base';
import {
  PROFILE_DOMAINS,
  domainHasData,
  formatTimezoneLabel,
  getPrioritizedJobs,
  getCurrentChapter,
  profileCompletenessPercent,
  profileDisplayName,
  profileSubtitle,
  profileTimezone,
  type ProfileDomain,
} from '@/lib/profile/summary';
import ProfilePeopleSection from './ProfilePeopleSection';
import { userDateYmd, userDayOfWeek, userLocalTime } from '@/lib/calendar/user-time';
import { TIMEZONES } from '@/types/knowledge-base';
import { Label, SelectField, TextArea, TextField } from '../forms';

function CompletenessRing({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-accent/30 text-[10px] font-semibold text-accent tabular-nums">
        {percent}
      </span>
      <span>Profile {percent}% complete</span>
    </div>
  );
}

interface SummaryProps {
  data: KnowledgeBase;
  onEditChapter: (chapter: string) => void;
  onUpdateJob: (job: JobApplication, patch: Partial<JobApplication>) => void;
  onRemoveJob: (job: JobApplication) => void;
  onUpsertPerson: (
    patch: Omit<ProfilePerson, 'id' | 'status'> & { id?: string; status?: ProfilePersonStatus },
  ) => void | Promise<void>;
  onSetPersonStatus: (id: string, status: ProfilePersonStatus) => void | Promise<void>;
  onSaveTimezone: (timezone: string) => void | Promise<void>;
  timezoneSaving?: boolean;
  onOpenDomain: (domain: ProfileDomain) => void;
  onOpenChat: (draft: string) => void;
}

export default function ProfileSummaryView({
  data,
  onEditChapter,
  onUpdateJob,
  onRemoveJob,
  onUpsertPerson,
  onSetPersonStatus,
  onSaveTimezone,
  timezoneSaving = false,
  onOpenDomain,
  onOpenChat,
}: SummaryProps) {
  const [editingChapter, setEditingChapter] = useState(false);
  const [chapterDraft, setChapterDraft] = useState('');
  const [editingJobKey, setEditingJobKey] = useState<string | null>(null);

  const chapter = getCurrentChapter(data);
  const jobs = getPrioritizedJobs(data, 5);
  const completeness = profileCompletenessPercent(data);
  const subtitle = profileSubtitle(data);
  const timezone = profileTimezone(data);
  const tzForClock = timezone || 'UTC';
  const now = new Date();

  const startChapterEdit = () => {
    setChapterDraft(chapter);
    setEditingChapter(true);
  };

  const saveChapter = () => {
    onEditChapter(chapterDraft.trim());
    setEditingChapter(false);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{profileDisplayName(data)}</h2>
        {subtitle && <p className="text-sm text-foreground-muted">{subtitle}</p>}
        <CompletenessRing percent={completeness} />
      </header>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">Timezone</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Daily brief, calendar, and &quot;today&quot; use this — not UTC.
            </p>
          </div>
          {timezoneSaving && (
            <span className="text-[11px] text-foreground-subtle shrink-0">Saving…</span>
          )}
        </div>
        <div>
          <Label hint={timezone ? undefined : 'Required for correct morning brief dates'}>Your timezone</Label>
          <SelectField
            value={timezone}
            onChange={v => { void onSaveTimezone(v); }}
            options={TIMEZONES}
            placeholder="Select timezone"
          />
        </div>
        <p className="text-[11px] text-foreground-subtle">
          {timezone ? (
            <>
              Now in {formatTimezoneLabel(timezone)}:{' '}
              <span className="text-foreground-muted tabular-nums">
                {userDayOfWeek(now, tzForClock)}, {userDateYmd(now, tzForClock)} · {userLocalTime(now, tzForClock)}
              </span>
            </>
          ) : (
            <>Pick Australia/Sydney (or your city) so Daily OS labels the right date.</>
          )}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface-subtle/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">Current chapter</h3>
          {!editingChapter && chapter && (
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
              rows={3}
              placeholder="A short narrative — what chapter of life are you in?"
            />
            <div className="flex gap-2">
              <button type="button" onClick={saveChapter} className="px-3 py-1.5 btn-primary text-xs">
                Save
              </button>
              <button type="button" onClick={() => setEditingChapter(false)} className="px-3 py-1.5 btn-secondary text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : chapter ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{chapter}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-foreground-muted">One short paragraph — not your whole CV.</p>
            <button type="button" onClick={startChapterEdit} className="text-xs text-accent hover:underline">
              Write chapter
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => onOpenChat('Help me write a short current chapter for my profile: ')}
              className="text-xs text-accent hover:underline"
            >
              Draft with chat
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">Priorities</h3>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No active priorities.{' '}
            <button
              type="button"
              onClick={() => onOpenChat('Update my job search priorities: ')}
              className="text-accent hover:underline"
            >
              Add via chat
            </button>
          </p>
        ) : (
          <ol className="space-y-2">
            {jobs.map((job, index) => (
              <PriorityRow
                key={`${job.company}-${job.role}-${index}`}
                job={job}
                rank={index + 1}
                expanded={editingJobKey === jobKey(job)}
                onToggle={() => setEditingJobKey(k => (k === jobKey(job) ? null : jobKey(job)))}
                onSave={patch => {
                  onUpdateJob(job, patch);
                  setEditingJobKey(null);
                }}
                onRemove={() => {
                  onRemoveJob(job);
                  setEditingJobKey(null);
                }}
              />
            ))}
          </ol>
        )}
      </section>

      <ProfilePeopleSection
        data={data}
        onUpsertPerson={onUpsertPerson}
        onSetStatus={onSetPersonStatus}
        onOpenChat={onOpenChat}
      />

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide px-1">More detail</h3>
        <p className="text-[11px] text-foreground-subtle px-1 mb-2">Detail views — chat or agents keep these fresh.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROFILE_DOMAINS.filter(d => d.id !== 'contacts').map(domain => (
            <button
              key={domain.id}
              type="button"
              onClick={() => onOpenDomain(domain.id)}
              className="text-left rounded-xl border border-border bg-surface hover:bg-surface-subtle/80 px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${domainHasData(data, domain.id) ? 'bg-accent' : 'bg-border'}`}
                />
                <span className="text-sm font-medium text-foreground">{domain.label}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <footer className="pt-2">
        <button
          type="button"
          onClick={() => onOpenChat('Update my profile: ')}
          className="px-3 py-2 btn-secondary text-xs"
        >
          Update anything via chat
        </button>
      </footer>
    </div>
  );
}

function jobKey(job: JobApplication): string {
  return `${job.company ?? ''}|${job.role ?? ''}`;
}

function PriorityRow({
  job,
  rank,
  expanded,
  onToggle,
  onSave,
  onRemove,
}: {
  job: JobApplication;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<JobApplication>) => void;
  onRemove: () => void;
}) {
  const [status, setStatus] = useState(job.status ?? '');
  const [nextAction, setNextAction] = useState(job.nextAction ?? '');
  const title = [job.company, job.role].filter(Boolean).join(' — ') || 'Application';

  useEffect(() => {
    if (expanded) {
      setStatus(job.status ?? '');
      setNextAction(job.nextAction ?? '');
    }
  }, [expanded, job.status, job.nextAction]);

  return (
    <li className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 hover:bg-surface-subtle/50 flex gap-3"
      >
        <span className="text-xs font-semibold text-accent tabular-nums w-5 shrink-0">{rank}.</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {!expanded && (job.status || job.nextAction) && (
            <p className="text-xs text-foreground-muted mt-0.5 truncate">
              {[job.status, job.nextAction].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className="text-[10px] text-foreground-subtle shrink-0 self-center">{expanded ? '▲' : 'Edit'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/40 bg-surface-subtle/30">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-foreground-subtle">Status</label>
            <TextField value={status} onChange={setStatus} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-foreground-subtle">Next action</label>
            <TextField value={nextAction} onChange={setNextAction} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSave({ status, nextAction })}
              className="px-3 py-1.5 btn-primary text-xs"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1.5 btn-secondary text-xs text-red-700 dark:text-red-300"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
