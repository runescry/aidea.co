'use client';

import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

let mermaidReady = false;

function ensureMermaid(): void {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  });
  mermaidReady = true;
}

interface Props {
  chart: string;
}

export default function MermaidDiagram({ chart }: Props) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
    mermaid
      .render(`mermaid-${id}`, chart.trim())
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Diagram failed to render');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="my-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium mb-2">Mermaid diagram error</p>
        <pre className="text-xs whitespace-pre-wrap font-mono opacity-80">{error}</pre>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs">Source</summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">{chart.trim()}</pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-6 flex h-32 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="doc-mermaid my-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-6 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
