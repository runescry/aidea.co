'use client';

import { useState, useCallback } from 'react';
import { ENTITY_RUN_META, HOME_RUN_ENTITIES, type HomeRunnableEntity } from '@/lib/entities/run-meta';

interface Props {
  disabled?: boolean;
  onStartRun: (entityType: HomeRunnableEntity, input: Record<string, unknown>) => void;
}

export default function EntityRunLauncher({ disabled, onStartRun }: Props) {
  const [openEntity, setOpenEntity] = useState<HomeRunnableEntity | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const close = useCallback(() => {
    setOpenEntity(null);
    setFields({});
  }, []);

  const handleStart = () => {
    if (!openEntity) return;
    const meta = ENTITY_RUN_META[openEntity];
    const input: Record<string, unknown> = {};
    for (const field of meta.fields) {
      if (fields[field.key]) {
        input[field.key] = field.type === 'number' ? Number(fields[field.key]) : fields[field.key];
      }
    }
    onStartRun(openEntity, input);
    close();
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {HOME_RUN_ENTITIES.map(entity => (
          <button
            key={entity}
            type="button"
            disabled={disabled}
            onClick={() => { setOpenEntity(entity); setFields({}); }}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-border disabled:opacity-50 transition-colors"
          >
            Run {ENTITY_RUN_META[entity].label}
          </button>
        ))}
      </div>

      {openEntity && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20"
            aria-label="Close run dialog"
            onClick={close}
          />
          <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md rounded-xl border border-border bg-surface shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {ENTITY_RUN_META[openEntity].label}
              </h3>
              <button type="button" onClick={close} className="text-foreground-muted hover:text-foreground p-1">×</button>
            </div>
            {ENTITY_RUN_META[openEntity].fields.map(field => (
              <div key={field.key}>
                <label className="block text-[11px] text-foreground-muted mb-1">{field.label}</label>
                {field.key === 'prompt' || field.key === 'idea' || field.key === 'goal' ? (
                  <textarea
                    rows={2}
                    className="input-field resize-none text-sm"
                    placeholder={field.placeholder}
                    value={fields[field.key] ?? ''}
                    onChange={e => setFields(f => ({ ...f, [field.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    className="input-field text-sm"
                    placeholder={field.placeholder}
                    value={fields[field.key] ?? ''}
                    onChange={e => setFields(f => ({ ...f, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <button type="button" onClick={handleStart} className="btn-primary w-full text-sm">
              Start run
            </button>
          </div>
        </>
      )}
    </>
  );
}
