'use client';

import type { PersonContact } from '@/types/knowledge-base';
import { Label, TextField, TextArea } from '../forms';

interface Props {
  label: string;
  hint?: string;
  people: PersonContact[];
  onChange: (people: PersonContact[]) => void;
  showCompany?: boolean;
  addLabel?: string;
}

function emptyPerson(): PersonContact {
  return { name: '', email: '', relationship: '', notes: '', company: '' };
}

export default function PersonListEditor({
  label,
  hint,
  people,
  onChange,
  showCompany = false,
  addLabel = '+ Add person',
}: Props) {
  const update = (index: number, updates: Partial<PersonContact>) => {
    const next = [...people];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const remove = (index: number) => {
    const next = [...people];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label hint={hint}>{label}</Label>
        <button
          type="button"
          onClick={() => onChange([...people, emptyPerson()])}
          className="text-xs text-accent hover:underline"
        >
          {addLabel}
        </button>
      </div>
      {people.length === 0 && (
        <p className="text-xs text-foreground-subtle mb-2">None added yet — agents use this for inbox triage and relationship monitoring.</p>
      )}
      <div className="space-y-3">
        {people.map((person, i) => (
          <div key={i} className="card p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-foreground-muted">{label} {i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="text-xs text-foreground-subtle hover:text-danger">
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField value={person.name ?? ''} onChange={v => update(i, { name: v })} placeholder="Full name" />
              <TextField value={person.email ?? ''} onChange={v => update(i, { email: v })} placeholder="email@example.com" />
            </div>
            {showCompany && (
              <TextField value={person.company ?? ''} onChange={v => update(i, { company: v })} placeholder="Company / organisation" />
            )}
            <TextField value={person.relationship ?? ''} onChange={v => update(i, { relationship: v })} placeholder="How you know them (mentor, investor, co-founder…)" />
            <TextArea value={person.notes ?? ''} onChange={v => update(i, { notes: v })} placeholder="Context agents should know — last conversation, what matters to them, how often you connect" rows={2} />
          </div>
        ))}
      </div>
    </div>
  );
}
