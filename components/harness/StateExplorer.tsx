'use client';
import { useState } from 'react';

function JsonValue({ val, depth = 0 }: { val: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (val === null) return <span className="text-gray-500">null</span>;
  if (typeof val === 'boolean') return <span className="text-amber-400">{String(val)}</span>;
  if (typeof val === 'number') return <span className="text-blue-400">{val}</span>;
  if (typeof val === 'string') {
    if (val.startsWith('<!DOCTYPE') || val.startsWith('<html')) {
      return (
        <span className="text-green-400 italic cursor-pointer underline decoration-dotted"
          onClick={() => {
            const w = window.open('', '_blank');
            w?.document.write(val);
          }}>
          [HTML — click to preview]
        </span>
      );
    }
    if (val.length > 300) {
      return (
        <span
          className="text-green-400 cursor-pointer"
          onClick={() => alert(val)}
          title="Click to see full text"
        >
          "{val.slice(0, 150)}… ({val.length} chars)"
        </span>
      );
    }
    return <span className="text-green-400">"{val}"</span>;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-gray-500">[]</span>;
    return (
      <span>
        <button
          className="text-gray-500 hover:text-gray-300"
          onClick={() => setOpen(o => !o)}
        >
          {open ? '▾' : '▸'} [{val.length}]
        </button>
        {open && (
          <div className="ml-4 border-l border-gray-700 pl-2">
            {val.map((item, i) => (
              <div key={i}>
                <span className="text-gray-600">{i}: </span>
                <JsonValue val={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val as object);
    if (keys.length === 0) return <span className="text-gray-500">{'{}'}</span>;
    return (
      <span>
        <button
          className="text-gray-500 hover:text-gray-300"
          onClick={() => setOpen(o => !o)}
        >
          {open ? '▾' : '▸'} {'{'}…{'}'}
        </button>
        {open && (
          <div className="ml-4 border-l border-gray-700 pl-2">
            {keys.map(k => (
              <div key={k}>
                <span className="text-purple-400">{k}</span>
                <span className="text-gray-500">: </span>
                <JsonValue val={(val as Record<string, unknown>)[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span className="text-gray-400">{String(val)}</span>;
}

interface Props {
  entityState: Record<string, unknown>;
}

export default function StateExplorer({ entityState }: Props) {
  const keys = Object.keys(entityState);

  if (keys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        State is empty — agents write here as they work
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pr-1 space-y-1 text-xs font-mono">
      {keys.map(k => (
        <StateKey key={k} stateKey={k} value={entityState[k]} />
      ))}
    </div>
  );
}

function StateKey({ stateKey, value }: { stateKey: string; value: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-800 rounded bg-gray-900/50">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-gray-500">{open ? '▾' : '▸'}</span>
        <span className="text-amber-300 font-semibold">{stateKey}</span>
        <span className="ml-auto text-gray-600 text-[10px]">
          {typeof value === 'object' && value !== null
            ? `${Object.keys(value as object).length} keys`
            : typeof value}
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-gray-800">
          <JsonValue val={value} depth={0} />
        </div>
      )}
    </div>
  );
}
