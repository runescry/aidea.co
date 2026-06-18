'use client';
import { useState, useEffect, useCallback } from 'react';

interface KBData {
  identity?: { name?: string; role?: string; company?: string };
  family?: {
    children?: Array<{ name?: string; school?: string; peDay?: string[]; activities?: Record<string, string> }>;
    partner?: { name?: string; work?: string };
  };
  health?: {
    workoutSchedule?: Record<string, string>;
    dietaryPreferences?: string[];
    goalCalories?: number;
    currentGoals?: string[];
  };
  work?: {
    role?: string;
    currentProjects?: string[];
    urgentFrom?: string[];
    skipFrom?: string[];
  };
  preferences?: {
    newsTopics?: string[];
    briefingTime?: string;
    defaultAutonomyLevel?: string;
  };
}

function TextArrayInput({ value, onChange, placeholder }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={2}
      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-600 placeholder-gray-600"
      placeholder={placeholder ?? 'One per line'}
      value={value.join('\n')}
      onChange={e => onChange(e.target.value.split('\n').filter(Boolean))}
    />
  );
}

function TextField({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600 placeholder-gray-600"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-500 mb-1">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/50 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-200">{title}</span>
        <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-4 bg-gray-950/30">{children}</div>}
    </div>
  );
}

const WORKOUT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function KnowledgeBaseEditor() {
  const [data, setData] = useState<KBData>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/kb')
      .then(r => r.json())
      .then(d => setData(d as KBData))
      .catch(() => {});
  }, []);

  const save = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSaveAll = () => {
    save({
      identity: data.identity ?? {},
      family: data.family ?? {},
      health: data.health ?? {},
      work: data.work ?? {},
      preferences: data.preferences ?? {},
    });
  };

  const u = <K extends keyof KBData>(section: K, updates: Partial<KBData[K]>) => {
    setData(d => ({ ...d, [section]: { ...(d[section] as object ?? {}), ...updates } as KBData[K] }));
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Your context — agents read this to personalise every output.</p>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
        >
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save all'}
        </button>
      </div>

      <Section title="Identity">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <TextField value={data.identity?.name ?? ''} onChange={v => u('identity', { name: v })} placeholder="Your name" />
          </div>
          <div>
            <Label>Role</Label>
            <TextField value={data.identity?.role ?? ''} onChange={v => u('identity', { role: v })} placeholder="Founder / CTO / Product Manager" />
          </div>
        </div>
        <div>
          <Label>Company</Label>
          <TextField value={data.identity?.company ?? ''} onChange={v => u('identity', { company: v })} placeholder="Company or project name" />
        </div>
      </Section>

      <Section title="Health">
        <div>
          <Label>Workout schedule (day → session type)</Label>
          <div className="grid grid-cols-4 gap-2">
            {WORKOUT_DAYS.map(day => (
              <div key={day}>
                <div className="text-[10px] text-gray-600 mb-1">{day}</div>
                <input
                  type="text"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-600 placeholder-gray-700"
                  placeholder="rest"
                  value={(data.health?.workoutSchedule ?? {})[day] ?? ''}
                  onChange={e => u('health', {
                    workoutSchedule: { ...(data.health?.workoutSchedule ?? {}), [day]: e.target.value },
                  })}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Daily calorie goal</Label>
            <input
              type="number"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600 placeholder-gray-600"
              placeholder="2200"
              value={data.health?.goalCalories ?? ''}
              onChange={e => u('health', { goalCalories: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label>Dietary preferences / restrictions</Label>
          <TextArrayInput
            value={data.health?.dietaryPreferences ?? []}
            onChange={v => u('health', { dietaryPreferences: v })}
            placeholder="No gluten&#10;High protein&#10;Vegetarian"
          />
        </div>
        <div>
          <Label>Current health goals</Label>
          <TextArrayInput
            value={data.health?.currentGoals ?? []}
            onChange={v => u('health', { currentGoals: v })}
            placeholder="Lose 5kg&#10;Run 5k sub-25min"
          />
        </div>
      </Section>

      <Section title="Work">
        <div>
          <Label>Current projects</Label>
          <TextArrayInput
            value={data.work?.currentProjects ?? []}
            onChange={v => u('work', { currentProjects: v })}
            placeholder="Project Alpha&#10;Q3 fundraise&#10;Product rebrand"
          />
        </div>
        <div>
          <Label>Always-urgent senders (email addresses)</Label>
          <TextArrayInput
            value={data.work?.urgentFrom ?? []}
            onChange={v => u('work', { urgentFrom: v })}
            placeholder="investor@vc.com&#10;ceo@company.com"
          />
        </div>
        <div>
          <Label>Always-skip senders (newsletters, bots)</Label>
          <TextArrayInput
            value={data.work?.skipFrom ?? []}
            onChange={v => u('work', { skipFrom: v })}
            placeholder="noreply@newsletters.com&#10;updates@saas.com"
          />
        </div>
      </Section>

      <Section title="Preferences">
        <div>
          <Label>News topics</Label>
          <TextArrayInput
            value={data.preferences?.newsTopics ?? []}
            onChange={v => u('preferences', { newsTopics: v })}
            placeholder="AI / machine learning&#10;UK startup funding&#10;SaaS pricing"
          />
        </div>
        <div>
          <Label>Morning brief time</Label>
          <TextField
            value={data.preferences?.briefingTime ?? ''}
            onChange={v => u('preferences', { briefingTime: v })}
            placeholder="06:30"
          />
        </div>
      </Section>
    </div>
  );
}
