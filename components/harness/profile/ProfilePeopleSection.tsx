'use client';

import { useMemo, useState } from 'react';
import type { KnowledgeBase, ProfilePerson, ProfilePersonStatus } from '@/types/knowledge-base';
import { buildVisibleContactGraph, recentContactInteractions, type ContactGraphEntry } from '@/lib/contacts/interaction-graph';
import { listMergeTargets, listUnlinkedContactSignals, personEmails, personPhones } from '@/lib/profile/people';
import { useConfirm } from '@/hooks/useConfirm';
import { formatLastTouch, getArchivedPeople, getCoolingContacts, getRemovedPeople } from '@/lib/profile/summary';
import { Label, TextArea, TextField } from '../forms';

interface Props {
  data: KnowledgeBase;
  onUpsertPerson: (
    patch: Omit<ProfilePerson, 'id' | 'status'> & { id?: string; status?: ProfilePersonStatus },
  ) => void | Promise<void>;
  onAddContactToPerson: (
    personId: string,
    contact: { email?: string; phone?: string },
  ) => void | Promise<void>;
  onSetStatus: (id: string, status: ProfilePersonStatus) => void | Promise<void>;
  onOpenChat: (draft: string) => void;
}

function entryKey(entry: ContactGraphEntry): string {
  return entry.id ?? entry.email ?? entry.name;
}

function ContactChipList({ items, onRemove }: { items: string[]; onRemove?: (item: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span
          key={item}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-[11px] text-foreground-muted"
        >
          {item}
          {onRemove && (
            <button type="button" onClick={() => onRemove(item)} className="text-foreground-subtle hover:text-foreground">
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function PersonSheet({
  entry,
  notes: initialNotes = '',
  extraEmails = [],
  extraPhones = [],
  onClose,
  onSave,
  onAddContact,
  onArchive,
  onRemove,
}: {
  entry: ContactGraphEntry;
  notes?: string;
  extraEmails?: string[];
  extraPhones?: string[];
  onClose: () => void;
  onSave: (patch: Omit<ProfilePerson, 'id' | 'status'> & { id?: string }) => void;
  onAddContact: (contact: { email?: string; phone?: string }) => void;
  onArchive: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [email, setEmail] = useState(entry.email ?? '');
  const [emails, setEmails] = useState(extraEmails);
  const [phones, setPhones] = useState(extraPhones);
  const [company, setCompany] = useState(entry.company ?? '');
  const [relationship, setRelationship] = useState(entry.relationship ?? '');
  const [notes, setNotes] = useState(initialNotes);
  const [newContact, setNewContact] = useState('');
  const interactions = recentContactInteractions(entry);

  const addContactMethod = () => {
    const value = newContact.trim();
    if (!value) return;
    if (value.includes('@')) {
      const normalized = value.toLowerCase();
      if (normalized === email.trim().toLowerCase() || emails.includes(normalized)) {
        setNewContact('');
        return;
      }
      if (entry.id) {
        onAddContact({ email: value });
        setEmails(prev => [...prev, normalized]);
      } else {
        setEmails(prev => [...prev, normalized]);
      }
    } else {
      const normalized = value.replace(/[^\d+]/g, '') || value;
      if (phones.includes(normalized)) {
        setNewContact('');
        return;
      }
      if (entry.id) {
        onAddContact({ phone: value });
        setPhones(prev => [...prev, normalized]);
      } else {
        setPhones(prev => [...prev, normalized]);
      }
    }
    setNewContact('');
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-subtle/80 p-3">
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
        <Label>Primary email</Label>
        <TextField value={email} onChange={setEmail} placeholder="optional" />
      </div>
      <div className="space-y-1.5">
        <Label>All emails</Label>
        <ContactChipList
          items={[...(email.trim() ? [email.trim().toLowerCase()] : []), ...emails.filter(e => e !== email.trim().toLowerCase())]}
          onRemove={item => {
            if (item === email.trim().toLowerCase()) setEmail('');
            else setEmails(prev => prev.filter(e => e !== item));
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Phone numbers</Label>
        <ContactChipList items={phones} onRemove={item => setPhones(prev => prev.filter(p => p !== item))} />
      </div>
      <div>
        <Label>Add email or phone</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField value={newContact} onChange={setNewContact} placeholder="work@… or +61…" />
          <button type="button" onClick={addContactMethod} className="btn-secondary min-h-11 w-full shrink-0 px-3 text-xs sm:min-h-0 sm:w-auto sm:py-1.5" disabled={!newContact.trim()}>
            Add
          </button>
        </div>
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
      <div className="space-y-2 border-t border-border/50 pt-3">
        <Label>Recent interactions</Label>
        {interactions.length > 0 ? (
          <ol className="space-y-2">
            {interactions.map((interaction, index) => (
              <li key={`${interaction.at}-${interaction.channel}-${index}`} className="rounded-md border border-border/50 bg-surface px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                    {interaction.channel}
                  </span>
                  <time className="text-[10px] text-foreground-subtle" dateTime={interaction.at}>
                    {formatLastTouch(interaction.at)}
                  </time>
                </div>
                {interaction.summary && (
                  <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{interaction.summary}</p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-foreground-subtle">No Gmail or Calendar interactions recorded yet.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => onSave({
            id: entry.id,
            name: name.trim(),
            email: email.trim() || undefined,
            emails: emails.length > 0 ? emails : undefined,
            phones: phones.length > 0 ? phones : undefined,
            company: company.trim() || undefined,
            relationship: relationship.trim() || undefined,
            notes: notes.trim() || undefined,
          })}
          className="btn-primary min-h-11 w-full px-3 text-xs sm:min-h-0 sm:w-auto sm:py-1.5"
          disabled={!name.trim()}
        >
          Save
        </button>
        {entry.status !== 'archived' && (
          <button type="button" onClick={onArchive} className="btn-secondary min-h-11 w-full px-3 text-xs sm:min-h-0 sm:w-auto sm:py-1.5">
            Archive
          </button>
        )}
        <button type="button" onClick={onRemove} className="btn-secondary col-span-2 min-h-11 w-full px-3 text-xs text-red-700 dark:text-red-300 sm:min-h-0 sm:w-auto sm:py-1.5">
          Remove from profile
        </button>
      </div>
    </div>
  );
}

function mergeTargetLabel(person: ProfilePerson): string {
  const email = person.email ?? person.emails?.[0];
  return email ? `${person.name} · ${email}` : person.name;
}

function defaultMergeTargetId(
  signal: { name: string; email?: string },
  targets: ProfilePerson[],
): string {
  const signalEmail = signal.email?.trim().toLowerCase();
  if (signalEmail) {
    const byEmail = targets.find(p => personEmails(p).includes(signalEmail));
    if (byEmail) return byEmail.id;
  }
  const signalName = signal.name.trim().toLowerCase();
  const byName = targets.find(p => p.name.trim().toLowerCase() === signalName);
  return byName?.id ?? '';
}

function AddToContactRow({
  signal,
  targets,
  onAdd,
}: {
  signal: { name: string; email?: string; phone?: string; lastTouch?: string };
  targets: ProfilePerson[];
  onAdd: (personId: string, contact: { email?: string; phone?: string }) => void;
}) {
  const [targetId, setTargetId] = useState(() => defaultMergeTargetId(signal, targets));
  const label = signal.email ?? signal.phone ?? signal.name;

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg px-3 py-2 border border-border/60 bg-surface-subtle/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{signal.name}</p>
        <p className="text-xs text-foreground-muted truncate">
          {[label, signal.lastTouch ? formatLastTouch(signal.lastTouch) : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-2 text-xs sm:min-w-[10rem] sm:max-w-[14rem]"
        >
          <option value="">Add to contact…</option>
          {targets.map(person => (
            <option key={person.id} value={person.id}>{mergeTargetLabel(person)}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!targetId}
          onClick={() => {
            if (!targetId) return;
            onAdd(targetId, { email: signal.email, phone: signal.phone });
          }}
          className="btn-primary min-h-11 shrink-0 px-3 text-xs disabled:opacity-50 sm:min-h-0 sm:py-1.5"
        >
          Add
        </button>
      </div>
    </li>
  );
}

export default function ProfilePeopleSection({
  data,
  onUpsertPerson,
  onAddContactToPerson,
  onSetStatus,
  onOpenChat,
}: Props) {
  const confirm = useConfirm();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRelationship, setNewRelationship] = useState('');

  const people = useMemo(() => buildVisibleContactGraph(data), [data]);
  const mergeTargets = useMemo(() => listMergeTargets(data), [data]);
  const unlinked = useMemo(() => listUnlinkedContactSignals(data), [data]);
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
    <section className="space-y-3 rounded-xl border border-domain-people/25 bg-domain-people/[0.1] p-3 sm:p-4">
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

      {unlinked.length > 0 && !selected && (
        <div className="space-y-2">
          <p className="text-xs text-foreground-muted">
            Seen in mail but not linked to a contact — add to an existing person to reduce duplicates.
          </p>
          {mergeTargets.length === 0 ? (
            <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Add a person below first, then link these addresses to them.
            </p>
          ) : (
            <ul className="space-y-1">
              {unlinked.slice(0, 5).map(signal => (
                <AddToContactRow
                  key={signal.email ?? signal.name}
                  signal={signal}
                  targets={mergeTargets}
                  onAdd={(personId, contact) => { void onAddContactToPerson(personId, contact); }}
                />
              ))}
            </ul>
          )}
        </div>
      )}

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
          extraEmails={selectedPerson ? personEmails(selectedPerson).filter(e => e !== selectedPerson.email?.toLowerCase()) : []}
          extraPhones={selectedPerson ? personPhones(selectedPerson) : []}
          onClose={() => setSelectedKey(null)}
          onSave={patch => {
            void onUpsertPerson(patch);
            setSelectedKey(null);
          }}
          onAddContact={contact => {
            if (selected.id) void onAddContactToPerson(selected.id, contact);
          }}
          onArchive={() => {
            if (selected.id) void onSetStatus(selected.id, 'archived');
            setSelectedKey(null);
          }}
          onRemove={async () => {
            if (!selected.id) return;
            const ok = await confirm({
              title: 'Remove from profile?',
              message: `${selected.name} will be removed from your profile and blocked from future agent updates. You can restore them from the removed list.`,
              confirmLabel: 'Remove',
              destructive: true,
            });
            if (ok) {
              void onSetStatus(selected.id, 'removed');
              setSelectedKey(null);
            }
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
                const emailCount = (entry.emails?.length ?? (entry.email ? 1 : 0));
                const phoneCount = entry.phones?.length ?? 0;
                const contactHint = [
                  emailCount > 1 ? `${emailCount} emails` : null,
                  phoneCount > 0 ? `${phoneCount} phone${phoneCount === 1 ? '' : 's'}` : null,
                ].filter(Boolean).join(' · ');
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
                          {[entry.relationship, entry.company, contactHint].filter(Boolean).join(' · ') || 'Contact'}
                        </p>
                      </div>
                      <div className="flex max-w-[42%] shrink-0 flex-col items-end gap-1 text-right">
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={addPerson} className="btn-primary min-h-11 w-full px-3 text-xs sm:min-h-0 sm:w-auto sm:py-1.5" disabled={!newName.trim()}>
                  Add
                </button>
                <button type="button" onClick={() => setAdding(false)} className="btn-secondary min-h-11 w-full px-3 text-xs sm:min-h-0 sm:w-auto sm:py-1.5">
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
