'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-foreground">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground-muted">{children}</em>
  ),
  h1: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground mb-2 mt-4 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground mb-2 mt-4 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2 mt-4 first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 last:mb-0 space-y-2 pl-4 list-disc marker:text-foreground-subtle">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 last:mb-0 space-y-2 pl-4 list-decimal marker:text-foreground-subtle">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-foreground pl-1">{children}</li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="text-[12px] font-mono bg-surface-subtle px-1 py-0.5 rounded">{children}</code>
  ),
  hr: () => <hr className="my-4 border-border" />,
};

interface Props {
  content: string;
}

export default function ChatMarkdown({ content }: Props) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
