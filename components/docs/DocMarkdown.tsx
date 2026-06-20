'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import MermaidDiagram from './MermaidDiagram';
import { resolveDocHref } from '@/lib/docs/catalog';

type HeadingNode = { position?: { start?: { line?: number } } };

function idAtLine(headingIdByLine: Record<string, string>, node?: HeadingNode): string {
  const line = node?.position?.start?.line;
  if (!line) return '';
  return headingIdByLine[String(line)] ?? '';
}

function buildComponents(
  headingIdByLine: Record<string, string>,
  onNavigate?: () => void,
): Components {
  return {
    h1: ({ node, children }) => (
      <h1 id={idAtLine(headingIdByLine, node)} className="doc-h1 scroll-mt-24">
        {children}
      </h1>
    ),
    h2: ({ node, children }) => (
      <h2 id={idAtLine(headingIdByLine, node)} className="doc-h2 scroll-mt-24">
        {children}
      </h2>
    ),
    h3: ({ node, children }) => (
      <h3 id={idAtLine(headingIdByLine, node)} className="doc-h3 scroll-mt-24">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="doc-h4 scroll-mt-24">{children}</h4>
    ),
    p: ({ children }) => <p className="doc-p">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
    em: ({ children }) => <em className="italic text-zinc-600">{children}</em>,
    ul: ({ children }) => <ul className="doc-ul">{children}</ul>,
    ol: ({ children }) => <ol className="doc-ol">{children}</ol>,
    li: ({ children }) => <li className="doc-li">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="doc-blockquote">{children}</blockquote>
    ),
    hr: () => <hr className="doc-hr" />,
    table: ({ children }) => (
      <div className="doc-table-wrap">
        <table className="doc-table">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="doc-thead">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="doc-tr">{children}</tr>,
    th: ({ children }) => <th className="doc-th">{children}</th>,
    td: ({ children }) => <td className="doc-td">{children}</td>,
    a: ({ href, children }) => {
      const resolved = resolveDocHref(href);
      const internal = resolved?.startsWith('/docs');
      if (internal && resolved) {
        return (
          <a href={resolved} className="doc-link" onClick={onNavigate}>
            {children}
          </a>
        );
      }
      return (
        <a
          href={resolved ?? href}
          className="doc-link"
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },
    code: ({ className, children, ...props }) => {
      const raw = String(children).replace(/\n$/, '');

      if (/language-mermaid/.test(className ?? '')) {
        return <MermaidDiagram chart={raw} />;
      }

      if (!className) {
        return (
          <code className="doc-inline-code" {...props}>
            {children}
          </code>
        );
      }

      return (
        <pre className="doc-pre">
          <code className={className} {...props}>
            {raw}
          </code>
        </pre>
      );
    },
    pre: ({ children }) => <>{children}</>,
  };
}

interface Props {
  content: string;
  headingIdByLine: Record<string, string>;
}

export default function DocMarkdown({ content, headingIdByLine }: Props) {
  return (
    <article className="doc-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(headingIdByLine)}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
