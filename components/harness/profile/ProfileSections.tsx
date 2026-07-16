'use client';

import type { ReactNode } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { WORKOUT_DAYS, TIMEZONES, PRONOUNS, COMPANY_STAGES } from '@/types/knowledge-base';
import { Label, TextField, TextArea, TextArrayInput, SelectField, Section } from '../forms';
import PersonListEditor from '../onboarding/PersonListEditor';
import { applyContactListToPeople, peopleContactsForEditor } from '@/lib/profile/people';
import ProjectsEditor from '../ProjectsEditor';

export type ProfileUpdater = <K extends keyof KnowledgeBase>(
  section: K,
  updates: Partial<NonNullable<KnowledgeBase[K]>>,
) => void;

export interface SectionProps {
  data: KnowledgeBase;
  u: ProfileUpdater;
  wrapSection?: boolean;
  embedded?: boolean;
}

function ProfileWrap({
  wrapSection = true,
  embedded = false,
  title,
  description,
  children,
}: {
  wrapSection?: boolean;
  embedded?: boolean;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  if (embedded) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-title text-foreground">{title}</h3>
          {description && <p className="text-xs text-foreground-subtle mt-0.5">{description}</p>}
        </div>
        {children}
      </div>
    );
  }
  if (!wrapSection) return <div className="space-y-3">{children}</div>;
  return <Section title={title} description={description}>{children}</Section>;
}

export function IdentitySection({ data, u, embedded }: SectionProps) {
  return (
    <ProfileWrap embedded={embedded} title="Identity" description="Who you are">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Name</Label><TextField value={data.identity?.name ?? ''} onChange={v => u('identity', { name: v })} /></div>
        <div><Label>Preferred name</Label><TextField value={data.identity?.preferredName ?? ''} onChange={v => u('identity', { preferredName: v })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><Label>Pronouns</Label><SelectField value={data.identity?.pronouns ?? ''} onChange={v => u('identity', { pronouns: v })} options={PRONOUNS} /></div>
        <div><Label>Age</Label><TextField value={data.identity?.age ?? ''} onChange={v => u('identity', { age: v })} /></div>
        <div><Label>Role</Label><TextField value={data.identity?.role ?? ''} onChange={v => u('identity', { role: v })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Company</Label><TextField value={data.identity?.company ?? ''} onChange={v => u('identity', { company: v })} /></div>
        <div><Label>Location</Label><TextField value={data.identity?.location ?? ''} onChange={v => u('identity', { location: v })} /></div>
      </div>
      <div><Label>Timezone</Label><SelectField value={data.identity?.timezone ?? ''} onChange={v => u('identity', { timezone: v })} options={TIMEZONES} /></div>
      <div><Label>Bio</Label><TextArea value={data.identity?.bio ?? ''} onChange={v => u('identity', { bio: v })} rows={3} /></div>
      <div><Label>Background</Label><TextArea value={data.identity?.background ?? ''} onChange={v => u('identity', { background: v })} rows={2} /></div>
      <div><Label>Values</Label><TextArrayInput value={data.identity?.values ?? []} onChange={v => u('identity', { values: v })} /></div>
      <div><Label>Strengths</Label><TextArrayInput value={data.identity?.strengths ?? []} onChange={v => u('identity', { strengths: v })} /></div>
      <div><Label>Aspirations</Label><TextArea value={data.identity?.aspirations ?? ''} onChange={v => u('identity', { aspirations: v })} rows={2} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Work email</Label><TextField value={data.identity?.workEmail ?? ''} onChange={v => u('identity', { workEmail: v })} /></div>
        <div><Label>Personal email</Label><TextField value={data.identity?.personalEmail ?? ''} onChange={v => u('identity', { personalEmail: v })} /></div>
      </div>
    </ProfileWrap>
  );
}

export function WorkSection({ data, u, embedded }: SectionProps) {
  return (
    <ProfileWrap embedded={embedded} title="Work" description="Role, projects, and comms rules">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Work role</Label><TextField value={data.work?.role ?? ''} onChange={v => u('work', { role: v })} /></div>
        <div><Label>Company stage</Label><SelectField value={data.work?.companyStage ?? ''} onChange={v => u('work', { companyStage: v })} options={COMPANY_STAGES} /></div>
      </div>
      <PersonListEditor
        label="Key contacts"
        people={peopleContactsForEditor(data, 'contact')}
        onChange={v => u('relationships', { people: applyContactListToPeople(data, v, 'contact').relationships?.people })}
        showCompany
      />
      <div><Label>Current projects</Label><ProjectsEditor value={data.work?.currentProjects} onChange={v => u('work', { currentProjects: v })} /></div>
      <div><Label>Typical day</Label><TextArea value={data.work?.typicalDay ?? ''} onChange={v => u('work', { typicalDay: v })} rows={2} /></div>
      <div><Label>Meeting preferences</Label><TextArea value={data.work?.meetingPreferences ?? ''} onChange={v => u('work', { meetingPreferences: v })} rows={2} /></div>
      <div><Label>Communication style</Label><TextArea value={data.work?.communicationStyle ?? ''} onChange={v => u('work', { communicationStyle: v })} rows={2} /></div>
      <div><Label>Urgent senders</Label><TextArrayInput value={data.work?.urgentFrom ?? []} onChange={v => u('work', { urgentFrom: v })} /></div>
      <div><Label>Skip senders</Label><TextArrayInput value={data.work?.skipFrom ?? []} onChange={v => u('work', { skipFrom: v })} /></div>
    </ProfileWrap>
  );
}

export function RelationshipsSection({ data, u, embedded }: SectionProps) {
  return (
    <ProfileWrap embedded={embedded} title="Relationships" description="People you work and spend time with">
      <p className="text-xs text-foreground-muted">
        Add, edit, archive, or remove people on the Profile summary. Legacy lists below are read-only fallbacks during migration.
      </p>
      <details className="rounded-lg border border-border/60 p-3">
        <summary className="text-xs text-foreground-subtle cursor-pointer">Legacy list editor</summary>
        <div className="mt-3 space-y-4">
          <PersonListEditor label="Mentors" people={data.relationships?.mentors ?? []} onChange={v => u('relationships', { mentors: v })} showCompany />
          <PersonListEditor label="Collaborators" people={data.relationships?.collaborators ?? []} onChange={v => u('relationships', { collaborators: v })} showCompany />
          <PersonListEditor label="Friends" people={data.relationships?.friends ?? []} onChange={v => u('relationships', { friends: v })} />
        </div>
      </details>
    </ProfileWrap>
  );
}

export function GoalsSection({ data, u, wrapSection = true, embedded }: SectionProps) {
  return (
    <ProfileWrap wrapSection={wrapSection} embedded={embedded} title="Goals">
      <div><Label>Current chapter</Label><TextArea value={data.goals?.currentChapter ?? ''} onChange={v => u('goals', { currentChapter: v })} rows={3} placeholder="What life chapter are you in right now?" /></div>
      <div><Label>Life priorities</Label><TextArrayInput value={data.goals?.lifePriorities ?? []} onChange={v => u('goals', { lifePriorities: v })} /></div>
      <div><Label>Short-term</Label><TextArrayInput value={data.goals?.shortTerm ?? []} onChange={v => u('goals', { shortTerm: v })} /></div>
      <div><Label>Long-term</Label><TextArrayInput value={data.goals?.longTerm ?? []} onChange={v => u('goals', { longTerm: v })} /></div>
      <div><Label>Non-negotiables</Label><TextArrayInput value={data.goals?.nonNegotiables ?? []} onChange={v => u('goals', { nonNegotiables: v })} /></div>
    </ProfileWrap>
  );
}

export function LearningSection({ data, u, embedded }: SectionProps) {
  return (
    <ProfileWrap embedded={embedded} title="Learning">
      <div><Label>Interests</Label><TextArrayInput value={data.learning?.interests ?? []} onChange={v => u('learning', { interests: v })} /></div>
      <div><Label>Currently learning</Label><TextArrayInput value={data.learning?.currentlyLearning ?? []} onChange={v => u('learning', { currentlyLearning: v })} /></div>
      <div><Label>Reading list</Label><TextArrayInput value={data.learning?.readingList ?? []} onChange={v => u('learning', { readingList: v })} /></div>
    </ProfileWrap>
  );
}

export function FamilySection({ data, u, embedded }: SectionProps) {
  return (
    <ProfileWrap embedded={embedded} title="Family">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Partner</Label><TextField value={data.family?.partner?.name ?? ''} onChange={v => u('family', { partner: { ...data.family?.partner, name: v } })} /></div>
        <div><Label>Partner schedule</Label><TextField value={data.family?.partner?.work ?? ''} onChange={v => u('family', { partner: { ...data.family?.partner, work: v } })} /></div>
      </div>
      <div><Label>Household notes</Label><TextArea value={data.family?.householdNotes ?? ''} onChange={v => u('family', { householdNotes: v })} rows={2} /></div>
    </ProfileWrap>
  );
}

export function HealthSection({ data, u, embedded }: SectionProps) {
  return (
    <ProfileWrap embedded={embedded} title="Health profile" description="Schedule and goals agents use for planning">
      <div><Label>Workout schedule</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WORKOUT_DAYS.map(day => (
            <div key={day}>
              <div className="text-[10px] text-foreground-subtle mb-1">{day}</div>
              <input type="text" className="input-field-sm" placeholder="rest"
                value={(data.health?.workoutSchedule ?? {})[day] ?? ''}
                onChange={e => u('health', { workoutSchedule: { ...(data.health?.workoutSchedule ?? {}), [day]: e.target.value } })} />
            </div>
          ))}
        </div>
      </div>
      <div><Label>Sleep</Label><TextField value={data.health?.sleepSchedule ?? ''} onChange={v => u('health', { sleepSchedule: v })} /></div>
      <div><Label>Diet</Label><TextArrayInput value={data.health?.dietaryPreferences ?? []} onChange={v => u('health', { dietaryPreferences: v })} /></div>
      <div><Label>Health goals</Label><TextArrayInput value={data.health?.currentGoals ?? []} onChange={v => u('health', { currentGoals: v })} /></div>
    </ProfileWrap>
  );
}

export function RoutinesSection({ data, u, wrapSection = true, embedded }: SectionProps) {
  return (
    <ProfileWrap wrapSection={wrapSection} embedded={embedded} title="Routines">
      <div><Label>Morning</Label><TextArea value={data.routines?.morningRoutine ?? ''} onChange={v => u('routines', { morningRoutine: v })} rows={2} /></div>
      <div><Label>Evening</Label><TextArea value={data.routines?.eveningRoutine ?? ''} onChange={v => u('routines', { eveningRoutine: v })} rows={2} /></div>
    </ProfileWrap>
  );
}

export function PreferencesSection({ data, u, wrapSection = true, embedded }: SectionProps) {
  return (
    <ProfileWrap wrapSection={wrapSection} embedded={embedded} title="Preferences" description="Briefings, focus, and default autonomy">
      <div><Label>News topics</Label><TextArrayInput value={data.preferences?.newsTopics ?? []} onChange={v => u('preferences', { newsTopics: v })} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Brief time</Label><TextField value={data.preferences?.briefingTime ?? ''} onChange={v => u('preferences', { briefingTime: v })} /></div>
        <div><Label>Focus hours</Label><TextField value={data.preferences?.focusHours ?? ''} onChange={v => u('preferences', { focusHours: v })} /></div>
      </div>
      <div><Label>Writing tone</Label><TextArea value={data.preferences?.writingTone ?? ''} onChange={v => u('preferences', { writingTone: v })} rows={2} /></div>
      <div><Label>Default autonomy</Label><SelectField value={data.preferences?.defaultAutonomyLevel ?? ''} onChange={v => u('preferences', { defaultAutonomyLevel: v as NonNullable<KnowledgeBase['preferences']>['defaultAutonomyLevel'] })} options={['supervised', 'semi-autonomous', 'autonomous']} /></div>
      <p className="text-[11px] text-foreground-subtle">
        Per-domain autonomy (email, calendar, finance) is in Settings → Trust dashboard.
      </p>
    </ProfileWrap>
  );
}

type FinanceSub = NonNullable<KnowledgeBase['finance']>['subscriptions'] extends (infer T)[] | undefined ? T : never;

function emptySubscription(): FinanceSub {
  return { name: '', amount: undefined, cadence: 'monthly', renewsOn: '', notes: '' };
}

export function FinanceSection({ data, u, embedded }: SectionProps) {
  const subs = data.finance?.subscriptions ?? [];

  const updateSub = (index: number, updates: Partial<FinanceSub>) => {
    const next = [...subs];
    next[index] = { ...next[index], ...updates };
    u('finance', { subscriptions: next });
  };

  const removeSub = (index: number) => {
    const next = [...subs];
    next.splice(index, 1);
    u('finance', { subscriptions: next });
  };

  return (
    <ProfileWrap embedded={embedded} title="Finance" description="Subscriptions and budget notes for finance agents">
      <div><Label>Monthly budget notes</Label><TextArea value={data.finance?.monthlyBudgetNotes ?? ''} onChange={v => u('finance', { monthlyBudgetNotes: v })} rows={2} placeholder="Overall spending goals, accounts to watch…" /></div>
      <div className="space-y-3">
        <Label>Subscriptions</Label>
        {subs.map((sub, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-surface-subtle/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <TextField value={sub.name} onChange={v => updateSub(i, { name: v })} placeholder="Service name" />
              <TextField value={sub.amount != null ? String(sub.amount) : ''} onChange={v => updateSub(i, { amount: v ? Number(v) : undefined })} placeholder="Amount" type="number" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SelectField value={sub.cadence ?? ''} onChange={v => updateSub(i, { cadence: v as FinanceSub['cadence'] })} options={['monthly', 'yearly', 'weekly']} placeholder="Cadence" />
              <TextField value={sub.renewsOn ?? ''} onChange={v => updateSub(i, { renewsOn: v })} placeholder="Renews on (YYYY-MM-DD)" />
            </div>
            <TextArea value={sub.notes ?? ''} onChange={v => updateSub(i, { notes: v })} rows={2} placeholder="Notes" />
            <button type="button" onClick={() => removeSub(i)} className="text-xs text-danger hover:underline">Remove</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => u('finance', { subscriptions: [...subs, emptySubscription()] })}
          className="text-xs text-accent hover:underline"
        >
          + Add subscription
        </button>
      </div>
    </ProfileWrap>
  );
}
