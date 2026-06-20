'use client';
import { useEffect, useState } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { buildContactGraph, findContactEntry } from '@/lib/contacts/interaction-graph';
import { Label, TextField } from './forms';

export default function ContactLensPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [kb, setKb] = useState<KnowledgeBase>({});
  const [query, setQuery] = useState('');
  useEffect(() => {
    fetch('/api/kb').then(r => r.json()).then(d => setKb(d as KnowledgeBase)).catch(() => {});
  }, [refreshKey]);
  const graph = buildContactGraph(kb);
  const match = query.trim() ? findContactEntry(graph, query) : null;
  return (
    <section className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Contact lens</h3>
      <Label>Search by name or email</Label>
      <TextField value={query} onChange={setQuery} placeholder="Sarah Chen" />
      {match ? (
        <div className="rounded-lg bg-surface-subtle/80 p-3 text-sm border border-border/50">
          <p className="font-medium">{match.name}</p>
          {match.email && <p className="text-xs text-foreground-muted">{match.email}</p>}
        </div>
      ) : (
        <p className="text-xs text-foreground-subtle">{graph.entries.length} tracked contacts.</p>
      )}
    </section>
  );
}
