'use client';

import { useState } from 'react';

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1">
      <div className="text-xs font-medium text-foreground-muted">{children}</div>
      {hint && <div className="text-[11px] text-foreground-subtle mt-0.5">{hint}</div>}
    </div>
  );
}

export function TextField({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      className="input-field"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      rows={rows}
      className={className ? `${className} input-field resize-none` : 'input-field resize-none'}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export function TextArrayInput({ value, onChange, placeholder }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const items = Array.isArray(value) ? value : [];
  return (
    <textarea
      rows={3}
      className="input-field resize-none"
      placeholder={placeholder ?? 'One item per line'}
      value={items.join('\n')}
      onChange={e => onChange(e.target.value.split('\n').filter(Boolean))}
    />
  );
}

export function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="section-header">
        <div>
          <span className="text-sm font-medium text-foreground">{title}</span>
          {description && <p className="text-xs text-foreground-subtle mt-0.5">{description}</p>}
        </div>
        <span className="text-foreground-subtle text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-4">{children}</div>}
    </div>
  );
}

export function SelectField({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
}) {
  return (
    <select
      className="input-field"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}

export function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${configured ? 'bg-success' : 'bg-foreground-subtle'}`} />
  );
}
