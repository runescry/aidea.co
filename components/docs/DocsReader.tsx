'use client';

import Link from 'next/link';
import { DOC_CATALOG, type DocEntry, type DocHeading } from '@/lib/docs/catalog';
import DocMarkdown from './DocMarkdown';

interface Props {
  doc: DocEntry;
  content: string;
  headings: DocHeading[];
  headingIdByLine: Record<string, string>;
}

export default function DocsReader({ doc, content, headings, headingIdByLine }: Props) {
  return (
    <div className="doc-shell min-h-screen bg-stone-50 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              ← App
            </Link>
            <span className="text-zinc-300">|</span>
            <Link href="/docs" className="shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Docs
            </Link>
            <span className="hidden sm:inline text-zinc-300">/</span>
            <span className="hidden sm:inline truncate text-sm font-semibold text-zinc-900">
              {doc.title}
            </span>
          </div>
          <p className="hidden md:block text-xs text-zinc-500 truncate max-w-md">
            Light reading mode · Mermaid diagrams render below
          </p>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-20 space-y-1" aria-label="Documents">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Documents
            </p>
            <DocNavLinks currentSlug={doc.slug} />
          </nav>
        </aside>

        <main className="min-w-0 flex-1 max-w-3xl">
          <div className="mb-8 lg:hidden">
            <label htmlFor="doc-select" className="sr-only">
              Jump to document
            </label>
            <select
              id="doc-select"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={doc.slug}
              onChange={e => {
                window.location.href = `/docs/${e.target.value}`;
              }}
            >
              <DocSelectOptions />
            </select>
          </div>

          <DocMarkdown content={content} headingIdByLine={headingIdByLine} />
        </main>

        {headings.length > 0 && (
          <aside className="hidden xl:block w-56 shrink-0">
            <nav className="sticky top-20" aria-label="On this page">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                On this page
              </p>
              <ul className="space-y-1.5 border-l border-zinc-200 pl-3">
                {headings.map((h, i) => (
                  <li key={`${h.id}-${i}`}>
                    <a
                      href={`#${h.id}`}
                      className={`block text-sm text-zinc-600 hover:text-indigo-600 transition-colors ${
                        h.level === 3 ? 'pl-3 text-xs' : ''
                      }`}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}

function DocNavLinks({ currentSlug }: { currentSlug: string }) {
  return (
    <>
      {DOC_CATALOG.map(({ slug, title }) => (
        <Link
          key={slug}
          href={`/docs/${slug}`}
          className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
            slug === currentSlug
              ? 'bg-indigo-50 font-medium text-indigo-700'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          {title}
        </Link>
      ))}
    </>
  );
}

function DocSelectOptions() {
  return (
    <>
      {DOC_CATALOG.map(({ slug, title }) => (
        <option key={slug} value={slug}>
          {title}
        </option>
      ))}
    </>
  );
}
