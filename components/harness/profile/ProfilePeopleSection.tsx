'use client';

import { useMemo, useState } from 'react';
import type { KnowledgeBase, ProfilePerson, ProfilePersonStatus } from '@/types/knowledge-base';
import { buildVisibleContactGraph, type ContactGraphEntry } from '@/lib/contacts/interaction-graph';
import { formatLastTouch, getArchivedPeople, getCoolingContacts, getRemovedPeople } from '@/lib/profile/summary';
import { Label, TextArea, TextField } from '../forms';

interface Props {
  data: KnowledgeBase;
  onUpsertPerson: (
    patch: Omit<ProfilePerson, 'id' | 'status'> & { id?: string; status?: ProfilePersonStatus },
  ) => void | Promise<void>;
  onSetStatus: (id: string, status: ProfilePersonStatus) => void | Promise<void>;
  onOpenChat: (draft: string) => void;
}

function entryKey(entry: ContactGraphEntry): string {
  return entry.id ?? entry.email ?? entry.name;
}

function PersonSheet({
  entry,
  notes: initialNotes = '',
  onClose,
  onSave,
  onArchive,
  onRemove,
}: {
  entry: ContactGraphEntry;
  notes?: string;
  onClose: () => void;
  onSave: (patch: Omit<ProfilePerson, 'id' | 'status'> & { id?: string }) => void;
  onArchive: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [email, setEmail] = useState(entry.email ?? '');
  const [company, setCompany] = useState(entry.company ?? '');
  const [relationship, setRelationship] = useState(entry.relationship ?? '');
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div className="rounded-lg border border-border bg-surface-subtle/80 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Edit person</h4>
        <button type="button" onClick={onClose} className="text-xs text-foreground-subtle hover:text-foreground">
          Close
        </button>
      </div>
      <div>
        <Label>Name</Label>
        <TextField value={name} onChange={setName} />
      </div>
      <div>
        <Label>Email</Label>
        <TextField value={email} onChange={setEmail} placeholder="optional" />
      </div>
      <div>
        <Label>Company</Label>
        <TextField value={company} onChange={setCompany} />
      </div>
      <div>
        <Label>Relationship</Label>
        <TextField value={relationship} onChange={setRelationship} placeholder="mentor, friend, client…" />
      </div>
      <div>
        <Label>Notes</Label>
        <TextArea value={notes} onChange={setNotes} rows={2} placeholder="Optional context for agents" />
      </div>
      {entry.lastTouch && (
        <p className="text-[11px] text-foreground-subtle">Last touch · {formatLastTouch(entry.lastTouch)}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave({
            id: entry.id,
            name: name.trim(),
            email: email.trim() || undefined,
            company: company.trim() || undefined,
            relationship: relationship.trim() || undefined,
            notes: notes.trim() || undefined,
          })}
          className="px-3 py-1.5 btn-primary text-xs"
          disabled={!name.trim()}
        >
          Save
        </button>
        {entry.status !== 'archived' && (
          <button type="button" onClick={onArchive} className="px-3 py-1.5 btn-secondary text-xs">
            Archive
          </button>
        )}
        <button type="button" onClick={onRemove} className="px-3 py-1.5 btn-secondary text-xs text-red-700 dark:text-red-300">
          Remove from profile
        </button>
      </div>
    </div>
  );
}

export default function ProfilePeopleSection({
  data,
  onUpsertPerson,
  onSetStatus,
  onOpenChat,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRelationship, setNewRelationship] = useState('');

  const people = useMemo(() => buildVisibleContactGraph(data), [data]);
  const removed = useMemo(() => getRemovedPeople(data), [data]);
  const archived = useMemo(() => getArchivedPeople(data), [data]);
  const coolingKeys = useMemo(
    () => new Set(getCoolingContacts(data).map(entryKey)),
    [data],
  );
  const selected = selectedKey ? people.find(p => entryKey(p) === selectedKey) : null;
  const selectedPerson = useMemo(() => {
    if (!selected?.id) return undefined;
    return data.relationships?.people?.find(p => p.id === selected.id);
  }, [selected, data]);

  const addPerson = () => {
    if (!newName.trim()) return;
    void onUpsertPerson({
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      relationship: newRelationship.trim() || undefined,
    });
    setNewName('');
    setNewEmail('');
    setNewRelationship('');
    setAdding(false);
  };

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">People</h3>
        <button
          type="button"
          onClick={() => onOpenChat('Update people on my profile: ')}
          className="text-xs text-accent hover:underline"
        >
          Update via chat
        </button>
      </div>

      {coolingKeys.size > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Cooling: {people.filter(p => coolingKeys.has(entryKey(p))).slice(0, 3).map(p => p.name).join(', ')}
          {coolingKeys.size > 3 ? ` +${coolingKeys.size - 3} more` : ''}
        </p>
      )}

      {selected ? (
        <PersonSheet
          entry={selected}
          notes={selectedPerson?.notes ?? ''}
          onClose={() => setSelectedKey(null)}
          onSave={patch => {
            void onUpsertPerson(patch);
            setSelectedKey(null);
          }}
          onArchive={() => {
            if (selected.id) void onSetStatus(selected.id, 'archived');
            setSelectedKey(null);
          }}
          onRemove={() => {
            if (selected.id) void onSetStatus(selected.id, 'removed');
            setSelectedKey(null);
          }}
        />
      ) : (
        <>
          {people.length === 0 ? (
            <p className="text-sm text-foreground-muted">No contacts yet — add someone or let agents learn from mail.</p>
          ) : (
            <ul className="space-y-1">
              {people.map(entry => {
                const key = entryKey(entry);
                const cooling = coolingKeys.has(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className="w-full text-left rounded-lg px-3 py-2 border border-border/60 hover:bg-surface-subtle/80 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                        <p className="text-xs text-foreground-muted truncate">
                          {[entry.relationship, entry.company].filter(Boolean).join(' · ') || 'Contact'}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {cooling && (
                          <span className="text-[9px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            Cooling
                          </span>
                        )}
                        <span className="text-[11px] text-foreground-subtle">{formatLastTouch(entry.lastTouch)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {adding ? (
            <div className="rounded-lg border border-border/60 p-3 space-y-2 bg-surface-subtle/40">
              <Label>Name</Label>
              <TextField value={newName} onChange={setNewName} placeholder="Sarah Chen" />
              <Label>Email</Label>
              <TextField value={newEmail} onChange={setNewEmail} placeholder="optional" />
              <Label>Relationship</Label>
              <TextField value={newRelationship} onChange={setNewRelationship} placeholder="mentor, friend…" />
              <div className="flex gap-2">
                <button type="button" onClick={addPerson} className="px-3 py-1.5 btn-primary text-xs" disabled={!newName.trim()}>
                  Add
                </button>
                <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 btn-secondary text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="text-xs text-accent hover:underline">
              + Add person
            </button>
          )}
        </>
      )}

      {archived.length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map(person => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-surface-subtle/50 border border-border/40"
                >
                  <span className="text-sm text-foreground-muted truncate">{person.name}</span>
                  <button
                    type="button"
                    onClick={() => void onSetStatus(person.id, 'active')}
                    className="text-xs text-accent hover:underline shrink-0"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {removed.length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setShowRemoved(v => !v)}
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            {showRemoved ? 'Hide' : 'Show'} removed ({removed.length})
          </button>
          {showRemoved && (
            <ul className="mt-2 space-y-1">
              {removed.map(person => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-surface-subtle/50 border border-border/40"
                >
                  <span className="text-sm text-foreground-muted truncate">{person.name}</span>
                  <button
                    type="button"
                    onClick={() => void onSetStatus(person.id, 'active')}
                    className="text-xs text-accent hover:underline shrink-0"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
