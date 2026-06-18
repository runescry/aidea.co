'use client';

interface MustDoItem {
  priority: number;
  action: string;
  context: string;
  source: string;
}

interface ScheduleItem {
  time: string;
  title: string;
  location: string;
  attendees: string[];
  notes: string;
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
  generatedAt: string;
  mustDo: MustDoItem[];
  schedule: ScheduleItem[];
  logistics: string[];
  health: HealthBrief;
  news: NewsHeadline[];
  workPrep: WorkPrep;
}

const INTENSITY_COLOR: Record<string, string> = {
  rest: 'text-gray-500',
  light: 'text-green-400',
  moderate: 'text-amber-400',
  hard: 'text-red-400',
};

const SOURCE_BADGE: Record<string, string> = {
  email: 'bg-blue-900/50 text-blue-300',
  calendar: 'bg-purple-900/50 text-purple-300',
  project: 'bg-amber-900/50 text-amber-300',
};

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  if (empty) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-600">{title}</h3>
      {children}
    </div>
  );
}

export default function MorningBriefRenderer({ data }: { data: MorningBriefData }) {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="text-lg font-semibold text-white">
          {data.date ? new Date(data.date).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          }) : 'Morning Brief'}
        </div>
        <div className="text-xs text-gray-600">
          Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>

      {/* Must Do */}
      <Section title="Must do today" empty={!data.mustDo?.length}>
        <div className="space-y-2">
          {data.mustDo?.map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
              <span className="text-gray-700 font-mono text-xs mt-0.5 w-4 shrink-0">{item.priority}.</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{item.action}</div>
                {item.context && <div className="text-xs text-gray-500 mt-0.5">{item.context}</div>}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${SOURCE_BADGE[item.source] ?? 'bg-gray-800 text-gray-500'}`}>
                {item.source}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Logistics */}
      <Section title="Logistics" empty={!data.logistics?.length}>
        <div className="space-y-1">
          {data.logistics?.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-amber-500 shrink-0">!</span>
              <span className="text-gray-300">{flag}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Schedule */}
      <Section title="Today's schedule" empty={!data.schedule?.length}>
        <div className="space-y-1.5">
          {data.schedule?.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs font-mono text-gray-600 w-12 shrink-0 pt-0.5">{item.time}</span>
              <div>
                <div className="text-sm text-white">{item.title}</div>
                {item.location && <div className="text-xs text-gray-600">{item.location}</div>}
                {item.attendees?.length > 0 && (
                  <div className="text-xs text-gray-700">{item.attendees.slice(0, 3).join(', ')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Work Prep */}
      {data.workPrep?.firstMeeting && (
        <Section title="Meeting prep">
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-600">{data.workPrep.firstMeeting.time}</span>
              <span className="text-sm text-white font-medium">{data.workPrep.firstMeeting.title}</span>
            </div>
            {data.workPrep.attendeeContext?.length > 0 && (
              <div className="space-y-1">
                {data.workPrep.attendeeContext.map((a, i) => (
                  <div key={i} className="text-xs text-gray-400">
                    <span className="text-gray-300 font-medium">{a.name}</span>
                    {a.recentContext && <span className="text-gray-500"> — {a.recentContext}</span>}
                  </div>
                ))}
              </div>
            )}
            {data.workPrep.suggestedTalkingPoints?.length > 0 && (
              <div className="space-y-0.5">
                {data.workPrep.suggestedTalkingPoints.map((pt, i) => (
                  <div key={i} className="text-xs text-gray-500">• {pt}</div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Health */}
      {data.health?.todayWorkout && (
        <Section title="Health">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-600 mb-1">Workout</div>
              <div className="text-sm text-white">{data.health.todayWorkout}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-600">{data.health.estimatedDurationMins}min</span>
                <span className={`text-xs ${INTENSITY_COLOR[data.health.intensity] ?? 'text-gray-400'}`}>
                  {data.health.intensity}
                </span>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-600 mb-1">Hydration</div>
              <div className="text-sm text-white">{data.health.hydrationGoalLitres}L</div>
              {data.health.quickNote && (
                <div className="text-xs text-gray-500 mt-1">{data.health.quickNote}</div>
              )}
            </div>
          </div>
          {data.health.mealSuggestions?.length > 0 && (
            <div className="space-y-0.5">
              {data.health.mealSuggestions.map((meal, i) => (
                <div key={i} className="text-xs text-gray-500">• {meal}</div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* News */}
      <Section title="Headlines" empty={!data.news?.length}>
        <div className="space-y-2">
          {data.news?.map((item, i) => (
            <div key={i} className="border-l-2 border-gray-800 pl-3 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-gray-800 text-gray-500 px-1 rounded">{item.topic}</span>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-blue-400 hover:text-blue-300 line-clamp-1 transition-colors">
                    {item.title}
                  </a>
                ) : (
                  <span className="text-xs text-gray-300 line-clamp-1">{item.title}</span>
                )}
              </div>
              {item.whyRelevant && (
                <div className="text-[11px] text-gray-600">{item.whyRelevant}</div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
