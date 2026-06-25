'use client';

import { decodeBriefText, mustDoHeadline } from '@/lib/harness/morning-brief-must-do';

interface MustDoItem {
  priority: number;
  action: string;
  subject?: string;
  context: string;
  detail?: string;
  snippet?: string;
  source: string;
  urgency?: string;
  queueActionId?: string;
  messageId?: string;
  gmailUrl?: string;
}

interface ScheduleItem {
  time: string;
  title: string;
  location: string;
  attendees: string[];
  notes: string;
  date?: string;
}

interface HealthBrief {
  todayWorkout: string;
  estimatedDurationMins: number;
  intensity: string;
  mealSuggestions: string[];
  hydrationGoalLitres: number;
  quickNote: string;
}

interface NewsHeadline {
  topic: string;
  title: string;
  url: string;
  whyRelevant: string;
}

interface WorkPrep {
  firstMeeting: {
    title: string;
    time: string;
    attendees: string[];
  } | null;
  attendeeContext: Array<{ name: string; recentContext: string }>;
  suggestedTalkingPoints: string[];
  prepNotes: string;
}

interface MorningBriefData {
  date: string;
  dayOfWeek?: string;
  generatedAt: string;
  mustDo: MustDoItem[];
  schedule: ScheduleItem[];
  logistics: string[];
  tomorrowPreview?: ScheduleItem[];
  health: HealthBrief;
  news: NewsHeadline[];
  workPrep: WorkPrep;
}

const INTENSITY_COLOR: Record<string, string> = {
  rest: 'text-foreground-subtle',
  light: 'text-success',
  moderate: 'text-warning',
  hard: 'text-danger',
};

const SOURCE_BADGE: Record<string, string> = {
  email: 'bg-accent/10 text-accent',
  calendar: 'bg-accent/10 text-accent',
  project: 'bg-warning/10 text-warning',
};

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  if (empty) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">{title}</h3>
      {children}
    </div>
  );
}

export default function MorningBriefRenderer({ data }: { data: MorningBriefData }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-lg font-semibold text-foreground">
          {data.date ? new Date(data.date).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          }) : 'Morning Brief'}
        </div>
        <div className="text-xs text-foreground-subtle">
          Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>

      <Section title="Must do today" empty={!data.mustDo?.length}>
        <div className="space-y-2">
          {data.mustDo?.map((item, i) => {
            const headline = decodeBriefText(mustDoHeadline(item as unknown as Record<string, unknown>));
            return (
            <div key={i} className="card p-3 space-y-1.5">
              <div className="flex items-start gap-3">
                <span className="text-foreground-muted font-mono text-xs mt-0.5 w-4 shrink-0">{item.priority}.</span>
                <div className="flex-1 min-w-0">
                  {item.gmailUrl ? (
                    <a
                      href={item.gmailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent font-medium hover:underline"
                    >
                      {headline}
                    </a>
                  ) : (
                    <div className="text-sm text-foreground font-medium">{headline}</div>
                  )}
                  {item.context && <div className="text-xs text-foreground-muted">{item.context}</div>}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${SOURCE_BADGE[item.source] ?? 'bg-surface-subtle text-foreground-subtle'}`}>
                  {item.source}
                </span>
              </div>
              {item.detail && (
                <div className="text-xs text-foreground border-l-2 border-accent pl-2 ml-7 whitespace-pre-wrap">
                  {item.detail}
                </div>
              )}
              {item.queueActionId && (
                <div className="text-[11px] text-accent font-medium ml-7">
                  Reply draft queued — open Home → Inbox → Awaiting approval
                </div>
              )}
            </div>
            );
          })}
        </div>
      </Section>

      <Section title="Logistics" empty={!data.logistics?.length}>
        <div className="space-y-1">
          {data.logistics?.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-warning shrink-0">!</span>
              <span className="text-foreground-muted">{flag}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Today's schedule" empty={!data.schedule?.length}>
        <div className="space-y-1.5">
          {data.schedule?.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs font-mono text-foreground-subtle w-12 shrink-0 pt-0.5">{item.time}</span>
              <div>
                <div className="text-sm text-foreground font-medium">{item.title}</div>
                {item.location && <div className="text-xs text-foreground-muted">{item.location}</div>}
                {item.attendees?.length > 0 && (
                  <div className="text-xs text-foreground-subtle">{item.attendees.slice(0, 3).join(', ')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tomorrow preview" empty={!data.tomorrowPreview?.length}>
        <div className="space-y-1.5">
          {data.tomorrowPreview?.map((item, i) => (
            <div key={i} className="flex items-start gap-3 opacity-80">
              <span className="text-xs font-mono text-foreground-subtle w-12 shrink-0 pt-0.5">{item.time}</span>
              <div className="text-sm text-foreground-muted">{item.title}</div>
            </div>
          ))}
        </div>
      </Section>

      {data.workPrep?.firstMeeting && (
        <Section title="Meeting prep">
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground-subtle">{data.workPrep.firstMeeting.time}</span>
              <span className="text-sm text-foreground font-medium">{data.workPrep.firstMeeting.title}</span>
            </div>
            {data.workPrep.attendeeContext?.length > 0 && (
              <div className="space-y-1">
                {data.workPrep.attendeeContext.map((a, i) => (
                  <div key={i} className="text-xs text-foreground-muted">
                    <span className="text-foreground font-medium">{a.name}</span>
                    {a.recentContext && <span className="text-foreground-subtle"> — {a.recentContext}</span>}
                  </div>
                ))}
              </div>
            )}
            {data.workPrep.suggestedTalkingPoints?.length > 0 && (
              <div className="space-y-0.5">
                {data.workPrep.suggestedTalkingPoints.map((pt, i) => (
                  <div key={i} className="text-xs text-foreground-muted">• {pt}</div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {data.health?.todayWorkout && (
        <Section title="Health">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <div className="text-xs text-foreground-subtle mb-1">Workout</div>
              <div className="text-sm text-foreground">{data.health.todayWorkout}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-foreground-subtle">{data.health.estimatedDurationMins}min</span>
                <span className={`text-xs ${INTENSITY_COLOR[data.health.intensity] ?? 'text-foreground-muted'}`}>
                  {data.health.intensity}
                </span>
              </div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-foreground-subtle mb-1">Hydration</div>
              <div className="text-sm text-foreground">{data.health.hydrationGoalLitres}L</div>
              {data.health.quickNote && (
                <div className="text-xs text-foreground-muted mt-1">{data.health.quickNote}</div>
              )}
            </div>
          </div>
          {data.health.mealSuggestions?.length > 0 && (
            <div className="space-y-0.5">
              {data.health.mealSuggestions.map((meal, i) => (
                <div key={i} className="text-xs text-foreground-muted">• {meal}</div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title="Headlines" empty={!data.news?.length}>
        <div className="space-y-2">
          {data.news?.map((item, i) => (
            <div key={i} className="border-l-2 border-border pl-3 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-surface-subtle text-foreground-subtle px-1 rounded">{item.topic}</span>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-accent hover:underline line-clamp-1 transition-colors">
                    {item.title}
                  </a>
                ) : (
                  <span className="text-xs text-foreground-muted line-clamp-1">{item.title}</span>
                )}
              </div>
              {item.whyRelevant && (
                <div className="text-[11px] text-foreground-subtle">{item.whyRelevant}</div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
