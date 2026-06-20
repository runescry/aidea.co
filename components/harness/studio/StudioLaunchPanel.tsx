'use client';

import type { EntityType } from '@/lib/harness/types';
import { STUDIO_ENTITY_META } from '@/lib/entities/run-meta';
import EntityTypeIcon from './EntityTypeIcon';

const DAILY_STEPS = ['Inbox triage', 'Calendar', 'Health brief', 'News', 'Work prep', 'Morning brief'];

interface Props {
  entity: EntityType;
  fields: Record<string, string>;
  starting?: boolean;
  error?: string;
  onFieldChange: (key: string, value: string) => void;
  onStart: () => void;
}

export default function StudioLaunchPanel({
  entity,
  fields,
  starting,
  error,
  onFieldChange,
  onStart,
}: Props) {
  const meta = STUDIO_ENTITY_META[entity];

  return (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto bg-surface-muted/40 p-4 md:p-8">
      <div className="w-full max-w-lg space-y-3">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-caption text-danger">
            {error}
          </div>
        )}
        <div className="card p-5 md:p-6 space-y-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <EntityTypeIcon entity={entity} className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-title text-foreground">{meta.label}</h3>
            <p className="text-caption text-foreground-muted leading-relaxed">{meta.description}</p>
          </div>
        </div>

        {entity === 'daily' && (
          <div className="flex flex-wrap gap-1.5">
            {DAILY_STEPS.map(step => (
              <span
                key={step}
                className="text-micro px-2 py-1 rounded-md bg-surface-subtle text-foreground-muted border border-border"
              >
                {step}
              </span>
            ))}
          </div>
        )}

        {meta.fields.length > 0 && (
          <div className="space-y-3 pt-1 border-t border-border">
            {meta.fields.map(field => (
              <div key={field.key}>
                <label className="block text-caption font-medium text-foreground-muted mb-1.5">
                  {field.label}
                </label>
                {field.key === 'prompt' || field.key === 'idea' || field.key === 'goal' ? (
                  <textarea
                    rows={2}
                    className="input-field resize-none text-sm"
                    placeholder={field.placeholder}
                    value={fields[field.key] ?? ''}
                    disabled={starting}
                    onChange={e => onFieldChange(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    className="input-field text-sm"
                    placeholder={field.placeholder}
                    value={fields[field.key] ?? ''}
                    disabled={starting}
                    onChange={e => onFieldChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="btn-primary px-5 inline-flex items-center gap-2 disabled:opacity-70"
          >
            {starting && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-surface/30 border-t-surface animate-spin" />
            )}
            {starting ? 'Starting…' : `Run ${meta.label}`}
          </button>
          <p className="text-micro text-foreground-subtle">
            Output, agents, and tools appear below once the run starts.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
