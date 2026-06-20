'use client';

import { useState, useCallback } from 'react';
import type { KnowledgeBase, ChildProfile } from '@/types/knowledge-base';
import { formatProjectSummary } from '../ProjectsEditor';
import { WORKOUT_DAYS, TIMEZONES, PRONOUNS, COMPANY_STAGES } from '@/types/knowledge-base';
import { Label, TextField, TextArea, TextArrayInput, SelectField } from '../forms';
import PersonListEditor from './PersonListEditor';
import ProjectsEditor from '../ProjectsEditor';
import { GoalsSection, RoutinesSection, PreferencesSection } from '../profile/ProfileSections';

const STEPS = [
  { id: 'welcome', title: 'Welcome', subtitle: 'Build your chief of staff' },
  { id: 'identity-core', title: 'Who you are', subtitle: 'Basics' },
  { id: 'identity-story', title: 'Your story', subtitle: 'Background & values' },
  { id: 'identity-contact', title: 'Contact', subtitle: 'How to reach you' },
  { id: 'work-context', title: 'Work context', subtitle: 'Role & company' },
  { id: 'work-people', title: 'Work relationships', subtitle: 'Manager & key contacts' },
  { id: 'work-projects', title: 'Projects', subtitle: 'What you\'re working on' },
  { id: 'work-rhythm', title: 'Work rhythm', subtitle: 'Schedule & focus' },
  { id: 'work-inbox', title: 'Email rules', subtitle: 'Inbox triage' },
  { id: 'goals', title: 'Goals', subtitle: 'Priorities & direction' },
  { id: 'relationships', title: 'Relationships', subtitle: 'People who matter' },
  { id: 'family', title: 'Family & home', subtitle: 'Household context' },
  { id: 'health-fitness', title: 'Fitness', subtitle: 'Movement & body' },
  { id: 'health-lifestyle', title: 'Lifestyle', subtitle: 'Sleep, diet, energy' },
  { id: 'health-medical', title: 'Health notes', subtitle: 'Optional medical context' },
  { id: 'routines', title: 'Routines', subtitle: 'Daily & weekly rhythm' },
  { id: 'learning', title: 'Learning', subtitle: 'Curiosity & growth' },
  { id: 'preferences', title: 'Preferences', subtitle: 'How aidea works for you' },
  { id: 'complete', title: 'All set', subtitle: 'Profile saved' },
] as const;

interface Props {
  onComplete: () => void;
}

const INITIAL: KnowledgeBase = {
  identity: {},
  work: { keyContacts: [], directReports: [] },
  relationships: { mentors: [], collaborators: [], innerCircle: [], friends: [], reviewFrequency: 21 },
  goals: {},
  family: { children: [] },
  health: { workoutSchedule: {} },
  routines: {},
  learning: {},
  preferences: { defaultAutonomyLevel: 'semi-autonomous' },
};

function emptyChild(): ChildProfile {
  return { name: '', age: '', school: '', peDay: [], notes: '' };
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<KnowledgeBase>(INITIAL);

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const u = <K extends keyof KnowledgeBase>(section: K, updates: Partial<NonNullable<KnowledgeBase[K]>>) => {
    setData(d => ({
      ...d,
      [section]: { ...(d[section] as object ?? {}), ...updates } as KnowledgeBase[K],
    }));
  };

  const canContinue = (): boolean => {
    switch (current.id) {
      case 'identity-core':
        return Boolean(data.identity?.name?.trim());
      case 'work-context':
        return Boolean(data.work?.role?.trim() || data.identity?.role?.trim());
      default:
        return true;
    }
  };

  const saveAndFinish = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            ...data,
            preferences: { ...data.preferences, onboardingComplete: true },
          },
        }),
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [data, onComplete]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else saveAndFinish();
  };

  const back = () => { if (step > 0) setStep(s => s - 1); };

  const addChild = () => u('family', { children: [...(data.family?.children ?? []), emptyChild()] });
  const updateChild = (index: number, updates: Partial<ChildProfile>) => {
    const children = [...(data.family?.children ?? [])];
    children[index] = { ...children[index], ...updates };
    u('family', { children });
  };
  const removeChild = (index: number) => {
    const children = [...(data.family?.children ?? [])];
    children.splice(index, 1);
    u('family', { children });
  };

  const firstName = data.identity?.preferredName?.trim()
    || data.identity?.name?.split(' ')[0]
    || 'there';

  return (
    <div className="fixed inset-0 z-50 bg-surface-muted flex flex-col">
      <div className="h-1 bg-surface-subtle shrink-0">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-surface">
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground">aidea</div>
          <div className="text-xs text-foreground-subtle">Step {step + 1} of {STEPS.length} · ~15 min</div>
        </div>
        <div className="text-right max-w-xs">
          <div className="text-sm font-medium text-foreground">{current.title}</div>
          <div className="text-xs text-foreground-muted">{current.subtitle}</div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl mx-auto space-y-5">
          {current.id === 'welcome' && (
            <div className="text-center space-y-4 py-6">
              <div className="text-5xl">☀</div>
              <h1 className="text-2xl font-semibold text-foreground">Let&apos;s build your profile</h1>
              <p className="text-foreground-muted leading-relaxed">
                Your chief of staff needs real context — not generic prompts. We&apos;ll walk through
                who you are, how you work, who matters to you, and how you live. The more you share,
                the sharper every brief, draft, and recommendation becomes.
              </p>
              <div className="grid grid-cols-2 gap-2 text-left pt-2">
                {[
                  'Identity & contact details',
                  'Work role, projects & inbox rules',
                  'Goals & non-negotiables',
                  'Key relationships & family',
                  'Health, routines & energy',
                  'News, brief time & autonomy',
                ].map(text => (
                  <div key={text} className="card p-2.5 text-xs text-foreground-muted">{text}</div>
                ))}
              </div>
            </div>
          )}

          {current.id === 'identity-core' && (
            <>
              <StepIntro text="Agents address you correctly and understand your professional identity at a glance." />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label hint="Required">Legal / full name</Label>
                  <TextField value={data.identity?.name ?? ''} onChange={v => u('identity', { name: v })} placeholder="Alexandra Chen" />
                </div>
                <div>
                  <Label>Preferred name</Label>
                  <TextField value={data.identity?.preferredName ?? ''} onChange={v => u('identity', { preferredName: v })} placeholder="Alex" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Pronouns</Label>
                  <SelectField value={data.identity?.pronouns ?? ''} onChange={v => u('identity', { pronouns: v })} options={PRONOUNS} placeholder="Select" />
                </div>
                <div>
                  <Label>Age</Label>
                  <TextField value={data.identity?.age ?? ''} onChange={v => u('identity', { age: v })} placeholder="34" />
                </div>
                <div>
                  <Label>Primary role / title</Label>
                  <TextField value={data.identity?.role ?? ''} onChange={v => u('identity', { role: v })} placeholder="Founder & CEO" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City & country</Label>
                  <TextField value={data.identity?.location ?? ''} onChange={v => u('identity', { location: v })} placeholder="London, UK" />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <SelectField value={data.identity?.timezone ?? ''} onChange={v => u('identity', { timezone: v })} options={TIMEZONES} placeholder="Select timezone" />
                </div>
              </div>
              <div>
                <Label>Languages you work in</Label>
                <TextArrayInput value={data.identity?.languages ?? []} onChange={v => u('identity', { languages: v })} placeholder="English&#10;Mandarin" />
              </div>
            </>
          )}

          {current.id === 'identity-story' && (
            <>
              <StepIntro text="This is the narrative layer — who you are beyond a job title." />
              <div>
                <Label hint="2–4 sentences">Bio — how you&apos;d introduce yourself</Label>
                <TextArea value={data.identity?.bio ?? ''} onChange={v => u('identity', { bio: v })} rows={4}
                  placeholder="Second-time founder in B2B SaaS. Previously CPO at a Series B fintech. I optimise for craft, sustainable pace, and building things people actually use." />
              </div>
              <div>
                <Label>Professional background</Label>
                <TextArea value={data.identity?.background ?? ''} onChange={v => u('identity', { background: v })} rows={3}
                  placeholder="10 years in product. MBA. Started career in consulting. Deep expertise in payments and SMB software." />
              </div>
              <div>
                <Label>Core values (one per line)</Label>
                <TextArrayInput value={data.identity?.values ?? []} onChange={v => u('identity', { values: v })}
                  placeholder="Integrity over speed&#10;Family first&#10;Intellectual honesty&#10;Default to action" />
              </div>
              <div>
                <Label>Strengths agents should lean on</Label>
                <TextArrayInput value={data.identity?.strengths ?? []} onChange={v => u('identity', { strengths: v })}
                  placeholder="Strategic thinking&#10;Writing&#10;Hiring&#10;Customer empathy" />
              </div>
              <div>
                <Label>Growth areas / blind spots</Label>
                <TextArrayInput value={data.identity?.growthAreas ?? []} onChange={v => u('identity', { growthAreas: v })}
                  placeholder="Delegation&#10;Saying no&#10;Financial modelling" />
              </div>
              <div>
                <Label>1–3 year aspirations</Label>
                <TextArea value={data.identity?.aspirations ?? ''} onChange={v => u('identity', { aspirations: v })} rows={3}
                  placeholder="Build a category-defining company. Stay present as a parent. Maintain marathon fitness into my 40s." />
              </div>
            </>
          )}

          {current.id === 'identity-contact' && (
            <>
              <StepIntro text="Used when agents draft emails or need to reference your contact details." />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Work email</Label>
                  <TextField value={data.identity?.workEmail ?? ''} onChange={v => u('identity', { workEmail: v })} placeholder="alex@company.com" />
                </div>
                <div>
                  <Label>Personal email</Label>
                  <TextField value={data.identity?.personalEmail ?? ''} onChange={v => u('identity', { personalEmail: v })} placeholder="alex@gmail.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <TextField value={data.identity?.phone ?? ''} onChange={v => u('identity', { phone: v })} placeholder="+44 7700 900000" />
                </div>
                <div>
                  <Label>LinkedIn URL</Label>
                  <TextField value={data.identity?.linkedIn ?? ''} onChange={v => u('identity', { linkedIn: v })} placeholder="linkedin.com/in/alexchen" />
                </div>
              </div>
              <div>
                <Label>Website / portfolio</Label>
                <TextField value={data.identity?.website ?? ''} onChange={v => u('identity', { website: v })} placeholder="https://alexchen.com" />
              </div>
            </>
          )}

          {current.id === 'work-context' && (
            <>
              <StepIntro text="Your professional operating context — company, stage, and scope." />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label hint="Required if no role above">Work role</Label>
                  <TextField value={data.work?.role ?? ''} onChange={v => u('work', { role: v })} placeholder="Head of Product" />
                </div>
                <div>
                  <Label>Job title (if different)</Label>
                  <TextField value={data.work?.title ?? ''} onChange={v => u('work', { title: v })} placeholder="VP Product" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Company</Label>
                  <TextField value={data.identity?.company ?? ''} onChange={v => u('identity', { company: v })} placeholder="Acme Labs" />
                </div>
                <div>
                  <Label>Department / function</Label>
                  <TextField value={data.work?.department ?? ''} onChange={v => u('work', { department: v })} placeholder="Product & Design" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Industry</Label>
                  <TextField value={data.identity?.industry ?? data.work?.industry ?? ''} onChange={v => { u('identity', { industry: v }); u('work', { industry: v }); }} placeholder="B2B SaaS" />
                </div>
                <div>
                  <Label>Company stage</Label>
                  <SelectField value={data.work?.companyStage ?? ''} onChange={v => u('work', { companyStage: v })} options={COMPANY_STAGES} placeholder="Stage" />
                </div>
                <div>
                  <Label>Team size you manage</Label>
                  <TextField value={data.work?.teamSize ?? ''} onChange={v => u('work', { teamSize: v })} placeholder="12 people" />
                </div>
              </div>
              <div>
                <Label>Career focus right now</Label>
                <TextArea value={data.work?.careerFocus ?? ''} onChange={v => u('work', { careerFocus: v })} rows={2}
                  placeholder="Transitioning from IC to exec. Building a leadership team. Learning to fundraise." />
              </div>
            </>
          )}

          {current.id === 'work-people' && (
            <>
              <StepIntro text="Key contacts power inbox triage, meeting prep, and relationship monitoring." />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Your manager</Label>
                  <TextField value={data.work?.manager?.name ?? ''} onChange={v => u('work', { manager: { ...data.work?.manager, name: v } })} placeholder="Name" />
                </div>
                <div>
                  <Label>Manager email</Label>
                  <TextField value={data.work?.manager?.email ?? ''} onChange={v => u('work', { manager: { ...data.work?.manager, email: v } })} placeholder="email@company.com" />
                </div>
              </div>
              <PersonListEditor
                label="Direct reports"
                people={data.work?.directReports ?? []}
                onChange={v => u('work', { directReports: v })}
                addLabel="+ Add direct report"
              />
              <PersonListEditor
                label="Key contacts"
                hint="Always worth reading — investors, co-founders, board, key clients"
                people={data.work?.keyContacts ?? []}
                onChange={v => u('work', { keyContacts: v })}
                showCompany
                addLabel="+ Add key contact"
              />
            </>
          )}

          {current.id === 'work-projects' && (
            <>
              <StepIntro text="Agents prioritise email and prep meetings around what you&apos;re actually building." />
              <div>
                <Label>Active projects</Label>
                <ProjectsEditor value={data.work?.currentProjects} onChange={v => u('work', { currentProjects: v })} />
              </div>
              <div>
                <Label>Key stakeholders (free text, one per line)</Label>
                <TextArrayInput value={data.work?.keyStakeholders ?? []} onChange={v => u('work', { keyStakeholders: v })}
                  placeholder="Sarah — co-founder, owns eng&#10;James — board chair&#10;Maria — lead investor, Sequoia" />
              </div>
              <div>
                <Label>Tools & stack you use daily</Label>
                <TextArrayInput value={data.work?.toolsAndStack ?? []} onChange={v => u('work', { toolsAndStack: v })}
                  placeholder="Notion&#10;Linear&#10;Slack&#10;Google Workspace&#10;Figma" />
              </div>
            </>
          )}

          {current.id === 'work-rhythm' && (
            <>
              <StepIntro text="Helps agents schedule around your energy and protect focus time." />
              <div>
                <Label>Typical workday</Label>
                <TextArea value={data.work?.typicalDay ?? ''} onChange={v => u('work', { typicalDay: v })} rows={3}
                  placeholder="Review inbox 8–8:30. Deep work 9–12. Meetings 1–5. Admin & planning 5–6." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Deep work blocks</Label>
                  <TextField value={data.work?.deepWorkBlocks ?? ''} onChange={v => u('work', { deepWorkBlocks: v })} placeholder="Mon/Wed/Fri 9–12am" />
                </div>
                <div>
                  <Label>Work hours</Label>
                  <TextField value={data.work?.workHours ?? ''} onChange={v => u('work', { workHours: v })} placeholder="8:30am – 6pm" />
                </div>
              </div>
              <div>
                <Label>Office / work location</Label>
                <TextField value={data.work?.officeLocation ?? ''} onChange={v => u('work', { officeLocation: v })} placeholder="Hybrid — Tue/Thu in Shoreditch office" />
              </div>
              <div>
                <Label>Meeting preferences</Label>
                <TextArea value={data.work?.meetingPreferences ?? ''} onChange={v => u('work', { meetingPreferences: v })} rows={3}
                  placeholder="No meetings before 10am. Batch 1:1s on Tuesdays. Decline anything without an agenda. Max 4 external meetings per week." />
              </div>
              <div>
                <Label>Communication style</Label>
                <TextArea value={data.work?.communicationStyle ?? ''} onChange={v => u('work', { communicationStyle: v })} rows={2}
                  placeholder="Direct and concise. Bullet points over paragraphs. Acknowledge before disagreeing." />
              </div>
              <div>
                <Label>Decision-making style</Label>
                <TextArea value={data.work?.decisionStyle ?? ''} onChange={v => u('work', { decisionStyle: v })} rows={2}
                  placeholder="Need data for big calls. Fast on reversible decisions. Consult co-founder on hiring." />
              </div>
            </>
          )}

          {current.id === 'work-inbox' && (
            <>
              <StepIntro text="Inbox triage agents use these rules to surface signal and ignore noise." />
              <div>
                <Label>Email handling rules</Label>
                <TextArea value={data.work?.emailHandlingRules ?? ''} onChange={v => u('work', { emailHandlingRules: v })} rows={3}
                  placeholder="Always respond to customers within 24h. Batch newsletter reading Friday. Never reply-all unless necessary." />
              </div>
              <div>
                <Label>Always-urgent senders (emails)</Label>
                <TextArrayInput value={data.work?.urgentFrom ?? []} onChange={v => u('work', { urgentFrom: v })}
                  placeholder="investor@vc.com&#10;ceo@company.com&#10;school@oakprimary.edu" />
              </div>
              <div>
                <Label>Always-skip senders</Label>
                <TextArrayInput value={data.work?.skipFrom ?? []} onChange={v => u('work', { skipFrom: v })}
                  placeholder="noreply@newsletters.com&#10;notifications@linkedin.com&#10;updates@saas.com" />
              </div>
            </>
          )}

          {current.id === 'goals' && (
            <>
              <StepIntro text="Agents trade off your priorities — not generic productivity advice." />
              <GoalsSection data={data} u={u} wrapSection={false} />
              <div>
                <Label>Anti-goals — what you&apos;re actively avoiding</Label>
                <TextArrayInput value={data.goals?.antiGoals ?? []} onChange={v => u('goals', { antiGoals: v })}
                  placeholder="Burnout cycles&#10;Reactive firefighting&#10;Shallow networking" />
              </div>
              <div>
                <Label>Legacy vision — how you want to be remembered</Label>
                <TextArea value={data.goals?.legacyVision ?? ''} onChange={v => u('goals', { legacyVision: v })} rows={2}
                  placeholder="Built products that genuinely helped small businesses. Raised kind, curious kids. Was present." />
              </div>
            </>
          )}

          {current.id === 'relationships' && (
            <>
              <StepIntro text="Relationship monitor tracks these people and nudges you before connections go cold." />
              <PersonListEditor label="Mentors & advisors" people={data.relationships?.mentors ?? []} onChange={v => u('relationships', { mentors: v })} showCompany addLabel="+ Add mentor" />
              <PersonListEditor label="Key collaborators" people={data.relationships?.collaborators ?? []} onChange={v => u('relationships', { collaborators: v })} showCompany addLabel="+ Add collaborator" />
              <PersonListEditor label="Inner circle" people={data.relationships?.innerCircle ?? []} onChange={v => u('relationships', { innerCircle: v })} addLabel="+ Add person" />
              <PersonListEditor label="Friends to stay close to" people={data.relationships?.friends ?? []} onChange={v => u('relationships', { friends: v })} addLabel="+ Add friend" />
              <div>
                <Label>Relationship check-in frequency (days)</Label>
                <TextField type="number" value={String(data.relationships?.reviewFrequency ?? 21)} onChange={v => u('relationships', { reviewFrequency: Number(v) || 21 })} placeholder="21" />
                <p className="text-[11px] text-foreground-subtle mt-1">How often agents should consider whether you&apos;ve been in touch.</p>
              </div>
            </>
          )}

          {current.id === 'family' && (
            <>
              <StepIntro text="Calendar and logistics agents use this for school runs, partner schedules, and household planning." />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Partner name</Label>
                  <TextField value={data.family?.partner?.name ?? ''} onChange={v => u('family', { partner: { ...data.family?.partner, name: v } })} placeholder="Jordan" />
                </div>
                <div>
                  <Label>Partner work / schedule</Label>
                  <TextField value={data.family?.partner?.work ?? ''} onChange={v => u('family', { partner: { ...data.family?.partner, work: v } })} placeholder="Teacher, Mon–Fri 8–4" />
                </div>
              </div>
              <div>
                <Label>Partner notes</Label>
                <TextArea value={data.family?.partner?.notes ?? ''} onChange={v => u('family', { partner: { ...data.family?.partner, notes: v } })} rows={2} placeholder="Travels Tue–Thu. Handles school pickup Wed." />
              </div>
              <div>
                <Label>Pets</Label>
                <TextArrayInput value={data.family?.pets ?? []} onChange={v => u('family', { pets: v })} placeholder="Max — golden retriever, needs walk 3pm&#10;Whiskers — cat" />
              </div>
              <div>
                <Label>Caregiving responsibilities</Label>
                <TextArea value={data.family?.caregiving ?? ''} onChange={v => u('family', { caregiving: v })} rows={2} placeholder="Aging parent — check in weekly. Mum lives 2hrs away." />
              </div>
              <div>
                <Label>Household logistics</Label>
                <TextArea value={data.family?.householdNotes ?? ''} onChange={v => u('family', { householdNotes: v })} rows={3}
                  placeholder="School drop-off 8:15. Cleaner Thursdays. Dog walker 3pm. Grocery delivery Sundays." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Children</Label>
                  <button type="button" onClick={addChild} className="text-xs text-accent hover:underline">+ Add child</button>
                </div>
                {(data.family?.children ?? []).map((child, i) => (
                  <div key={i} className="card p-3 mb-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-foreground-muted">Child {i + 1}</span>
                      <button type="button" onClick={() => removeChild(i)} className="text-xs text-foreground-subtle hover:text-danger">Remove</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <TextField value={child.name ?? ''} onChange={v => updateChild(i, { name: v })} placeholder="Name" />
                      <TextField value={child.age ?? ''} onChange={v => updateChild(i, { age: v })} placeholder="Age" />
                      <TextField value={child.school ?? ''} onChange={v => updateChild(i, { school: v })} placeholder="School" />
                    </div>
                    <TextField value={(child.peDay ?? []).join(', ')} onChange={v => updateChild(i, { peDay: v.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="PE days: Mon, Wed" />
                    <TextArea value={child.notes ?? ''} onChange={v => updateChild(i, { notes: v })} rows={2} placeholder="Football Tue 4pm. Allergies: nuts." />
                  </div>
                ))}
              </div>
            </>
          )}

          {current.id === 'health-fitness' && (
            <>
              <StepIntro text="Health brief agent plans workouts and movement around your schedule." />
              <div>
                <Label>Weekly workout schedule</Label>
                <div className="grid grid-cols-4 gap-2">
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
              <div>
                <Label>Current fitness level</Label>
                <TextField value={data.health?.fitnessLevel ?? ''} onChange={v => u('health', { fitnessLevel: v })} placeholder="Intermediate — run 5k regularly, starting strength training" />
              </div>
              <div>
                <Label>Active health & fitness goals</Label>
                <TextArrayInput value={data.health?.currentGoals ?? []} onChange={v => u('health', { currentGoals: v })}
                  placeholder="Run 5k sub-25min&#10;Deadlift 100kg&#10;Sleep 7+ hours&#10;Lose 5kg" />
              </div>
              <div>
                <Label>Injuries or physical limitations</Label>
                <TextArrayInput value={data.health?.injuries ?? []} onChange={v => u('health', { injuries: v })} placeholder="Left knee — avoid high impact&#10;Lower back — warm up required" />
              </div>
            </>
          )}

          {current.id === 'health-lifestyle' && (
            <>
              <StepIntro text="Energy-aware scheduling and meal suggestions use this context." />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sleep schedule</Label>
                  <TextField value={data.health?.sleepSchedule ?? ''} onChange={v => u('health', { sleepSchedule: v })} placeholder="Bed 10:30pm, up 6:30am" />
                </div>
                <div>
                  <Label>Daily calorie goal</Label>
                  <TextField type="number" value={String(data.health?.goalCalories ?? '')} onChange={v => u('health', { goalCalories: Number(v) || undefined })} placeholder="2200" />
                </div>
              </div>
              <div>
                <Label>Energy patterns through the day</Label>
                <TextArea value={data.health?.energyPatterns ?? ''} onChange={v => u('health', { energyPatterns: v })} rows={2}
                  placeholder="Peak focus 9–12am. Post-lunch slump 1–2pm. Creative work best after 4pm." />
              </div>
              <div>
                <Label>Dietary preferences & restrictions</Label>
                <TextArrayInput value={data.health?.dietaryPreferences ?? []} onChange={v => u('health', { dietaryPreferences: v })}
                  placeholder="High protein&#10;No gluten&#10;Vegetarian&#10;Intermittent fasting 16:8" />
              </div>
            </>
          )}

          {current.id === 'health-medical' && (
            <>
              <StepIntro text="Optional and private — helps agents avoid bad suggestions. Stored locally only." />
              <div>
                <Label>Allergies</Label>
                <TextArrayInput value={data.health?.allergies ?? []} onChange={v => u('health', { allergies: v })} placeholder="Peanuts&#10;Penicillin" />
              </div>
              <div>
                <Label>Current medications (names only)</Label>
                <TextArrayInput value={data.health?.medications ?? []} onChange={v => u('health', { medications: v })} placeholder="None" />
              </div>
              <div>
                <Label>Medical notes for agents</Label>
                <TextArea value={data.health?.medicalNotes ?? ''} onChange={v => u('health', { medicalNotes: v })} rows={2} placeholder="Asthma — keep inhaler nearby during cardio." />
              </div>
              <div>
                <Label>Mental health context (optional)</Label>
                <TextArea value={data.health?.mentalHealthNotes ?? ''} onChange={v => u('health', { mentalHealthNotes: v })} rows={2}
                  placeholder="Prone to anxiety before big presentations. Meditation helps. Therapy biweekly." />
              </div>
            </>
          )}

          {current.id === 'routines' && (
            <>
              <StepIntro text="Morning and evening routines help agents time briefs and protect your rituals." />
              <RoutinesSection data={data} u={u} wrapSection={false} />
              <div>
                <Label>Weekly rituals</Label>
                <TextArrayInput value={data.routines?.weeklyRituals ?? []} onChange={v => u('routines', { weeklyRituals: v })}
                  placeholder="Sunday planning session&#10;Friday team retro&#10;Saturday long run&#10;Wednesday date night" />
              </div>
              <div>
                <Label>Commute / travel notes</Label>
                <TextField value={data.routines?.commute ?? ''} onChange={v => u('routines', { commute: v })} placeholder="45min train to office Tue/Thu. WFH Mon/Wed/Fri." />
              </div>
            </>
          )}

          {current.id === 'learning' && (
            <>
              <StepIntro text="News curation and research agents use this to filter signal from noise." />
              <div>
                <Label>Topics you&apos;re curious about</Label>
                <TextArrayInput value={data.learning?.interests ?? []} onChange={v => u('learning', { interests: v })}
                  placeholder="AI agents&#10;Behavioural economics&#10;Parenting&#10;Endurance sport" />
              </div>
              <div>
                <Label>Currently learning</Label>
                <TextArrayInput value={data.learning?.currentlyLearning ?? []} onChange={v => u('learning', { currentlyLearning: v })}
                  placeholder="Fundraising mechanics&#10;Spanish — intermediate&#10;Rust programming" />
              </div>
              <div>
                <Label>Reading list / recent books</Label>
                <TextArrayInput value={data.learning?.readingList ?? []} onChange={v => u('learning', { readingList: v })}
                  placeholder="Thinking in Systems&#10;The Hard Thing About Hard Things&#10;Four Thousand Weeks" />
              </div>
            </>
          )}

          {current.id === 'preferences' && (
            <>
              <StepIntro text="Fine-tune how aidea delivers briefs and drafts on your behalf." />
              <PreferencesSection data={data} u={u} wrapSection={false} />
              <div>
                <Label>Decision speed preference</Label>
                <TextField value={data.preferences?.decisionSpeed ?? ''} onChange={v => u('preferences', { decisionSpeed: v })} placeholder="Fast on small calls, sleep on big ones" />
              </div>
              <div>
                <Label>Notification preferences</Label>
                <TextArea value={data.preferences?.notificationPreferences ?? ''} onChange={v => u('preferences', { notificationPreferences: v })} rows={2}
                  placeholder="Only interrupt for urgent inbox. Batch everything else into morning brief." />
              </div>
            </>
          )}

          {current.id === 'complete' && (
            <div className="text-center space-y-4 py-6">
              <div className="text-5xl">✓</div>
              <h1 className="text-2xl font-semibold text-foreground">Profile complete, {firstName}</h1>
              <p className="text-foreground-muted leading-relaxed">
                {countFilledSections(data)} sections saved. Agents will read this for every run.
                Add API keys in Settings to unlock Gmail, Calendar, and web search.
              </p>
              <div className="card p-4 text-left grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <SummaryRow label="Name" value={data.identity?.name} />
                <SummaryRow label="Role" value={data.work?.role || data.identity?.role} />
                <SummaryRow label="Projects" value={formatProjectSummary(data.work?.currentProjects)} />
                <SummaryRow label="Key contacts" value={`${data.work?.keyContacts?.length ?? 0} people`} />
                <SummaryRow label="Relationships" value={`${(data.relationships?.mentors?.length ?? 0) + (data.relationships?.collaborators?.length ?? 0)} tracked`} />
                <SummaryRow label="Brief time" value={data.preferences?.briefingTime || 'Not set'} />
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 flex items-center justify-between bg-surface shrink-0">
        <button type="button" onClick={back} disabled={step === 0} className="btn-secondary text-sm disabled:opacity-40">Back</button>
        <span className="text-xs text-foreground-subtle hidden sm:inline">{Math.round(progress)}% complete</span>
        <button type="button" onClick={next} disabled={!canContinue() || saving} className="btn-primary text-sm">
          {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Start using aidea' : 'Continue'}
        </button>
      </footer>
    </div>
  );
}

function StepIntro({ text }: { text: string }) {
  return <p className="text-sm text-foreground-muted">{text}</p>;
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <span className="text-foreground-muted">{label}</span>
      <span className="text-foreground truncate">{value || '—'}</span>
    </>
  );
}

function countFilledSections(data: KnowledgeBase): number {
  const sections = [data.identity, data.work, data.relationships, data.goals, data.family, data.health, data.routines, data.learning, data.preferences];
  return sections.filter(s => s && Object.keys(s).length > 0).length;
}
