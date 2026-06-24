'use client';

import { useEffect, useState, useCallback } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import {
  DEFAULT_INTERACTIVE_RUN_BUDGET,
  harnessCostModeLabel,
  isTokenBudgetEnforced,
  readHarnessCostPreferences,
  type HarnessCostMode,
} from '@/lib/harness/cost-preferences';
import { Label } from './forms';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';

export default function HarnessCostPanel() {
  const [kb, setKb] = useState<KnowledgeBase>({});
  const { saving, saved, runSave } = useSaveFeedback();

  const load = useCallback(() => {
    fetch('/api/kb')
      .then(r => r.json())
      .then(d => setKb(d as KnowledgeBase))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const prefs = readHarnessCostPreferences(kb);
  const enforceTokenBudget = isTokenBudgetEnforced(prefs);
  const costMode: HarnessCostMode = prefs.costMode ?? 'standard';
  const maxTokensPerRun = prefs.maxTokensPerRun ?? DEFAULT_INTERACTIVE_RUN_BUDGET;

  const updatePrefs = (patch: NonNullable<KnowledgeBase['preferences']>['harnessCost']) => {
    setKb(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        harnessCost: { ...prev.preferences?.harnessCost, ...patch },
      },
    }));
  };

  const save = () => void runSave(async () => {
    await fetch('/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { preferences: kb.preferences } }),
    });
    load();
  });

  return (
    <section className="card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Agent run budget</h3>
        <p className="text-xs text-foreground-muted mt-1">
          Daily OS and Studio runs. Off by default (unlimited). Crons keep their own lightweight caps.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 rounded border-border"
          checked={enforceTokenBudget}
          onChange={e => updatePrefs({ enforceTokenBudget: e.target.checked })}
        />
        <span className="text-sm text-foreground">
          Enforce token budget
          <span className="block text-xs text-foreground-muted font-normal mt-0.5">
            {enforceTokenBudget
              ? 'Runs stop when they hit the limits below.'
              : 'Unlimited — agents run until they finish (recommended).'}
          </span>
        </span>
      </label>

      {enforceTokenBudget && (
        <>
          <div className="space-y-2">
            <Label>Max tokens per run</Label>
            <input
              type="number"
              min={10_000}
              max={500_000}
              step={5_000}
              className="input-field text-sm max-w-xs"
              value={maxTokensPerRun}
              onChange={e => updatePrefs({
                maxTokensPerRun: Number(e.target.value) || DEFAULT_INTERACTIVE_RUN_BUDGET,
              })}
            />
            <p className="text-[11px] text-foreground-subtle">
              Shared pool across all agents (default {DEFAULT_INTERACTIVE_RUN_BUDGET.toLocaleString()}).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Budget mode</Label>
            <select
              value={costMode}
              onChange={e => updatePrefs({ costMode: e.target.value as HarnessCostMode })}
              className="input-field text-sm max-w-md py-1.5"
            >
              <option value="standard">{harnessCostModeLabel('standard')}</option>
              <option value="strict">{harnessCostModeLabel('strict')}</option>
            </select>
            <p className="text-[11px] text-foreground-subtle">
              {costMode === 'strict'
                ? 'Also caps each agent role so inbox triage cannot consume the whole pool.'
                : 'Only the shared run pool is enforced.'}
            </p>
          </div>
        </>
      )}

      <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs py-1.5 px-4">
        {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save budget settings'}
      </button>
    </section>
  );
}
