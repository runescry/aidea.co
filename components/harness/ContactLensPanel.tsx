'use client';

import { useMemo, useState } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { buildContactGraph, findContactEntry, recentContactInteractions, type ContactGraphEntry } from '@/lib/contacts/interaction-graph';
import { Label, TextField } from './forms';

function formatTouch(iso?: string): string {
  if (!iso) return 'No recent touch';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ContactDetail({ entry }: { entry: ContactGraphEntry }) {
  const interactions = recentContactInteractions(entry, 5);
  return (
    <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50 space-y-2">
      <div>
        <p className="font-medium text-foreground">{entry.name}</p>
        {entry.email && <p className="text-xs text-foreground-muted">{entry.email}</p>}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {entry.relationship && (
          <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-foreground-muted">
            {entry.relationship}
          </span>
        )}
        {entry.company && (
          <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-foreground-muted">
            {entry.company}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground-subtle">Last touch · {formatTouch(entry.lastTouch)}</p>
      {interactions.length > 0 && (
        <ul className="space-y-1.5 pt-1 border-t border-border/50">
          {interactions.map((item, i) => (
            <li key={`${item.at}-${i}`} className="text-xs text-foreground-muted">
              <span className="text-foreground-subtle">{formatTouch(item.at)}</span>
              {' · '}
              {item.channel}
              {item.summary ? ` — ${item.summary}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  data: KnowledgeBase;
}

export default function ContactLensPanel({ data }: Props) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const graph = useMemo(() => buildContactGraph(data), [data]);
  const match = query.trim() ? findContactEntry(graph, query) : null;
  const selected = selectedKey
    ? graph.find(e => (e.email ?? e.name) === selectedKey)
    : null;
  const active = match ?? selected;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-title text-foreground">Contact lens</h3>
        <p className="text-xs text-foreground-subtle mt-0.5">
          Search people from your KB and interaction graph — {graph.length} tracked.
        </p>
      </div>
      <div>
        <Label>Search by name or email</Label>
        <TextField value={query} onChange={setQuery} placeholder="Sarah Chen" />
      </div>
      {active ? (
        <ContactDetail entry={active} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-foreground-subtle">Recent contacts</p>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {graph.slice(0, 12).map(entry => {
              const key = entry.email ?? entry.name;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedKey(key);
                    setQuery('');
                  }}
                  className="w-full text-left rounded-lg px-3 py-2 border border-border/60 bg-surface-subtle/50 hover:bg-surface-subtle transition-colors"
                >
                  <div className="text-sm font-medium text-foreground">{entry.name}</div>
                  <div className="text-[11px] text-foreground-subtle truncate">
                    {[entry.relationship, entry.company, formatTouch(entry.lastTouch)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </button>
              );
            })}
            {graph.length === 0 && (
              <p className="text-xs text-foreground-subtle py-4 text-center">
                Add people under Work or Relationships, or let agents record interactions from mail.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
