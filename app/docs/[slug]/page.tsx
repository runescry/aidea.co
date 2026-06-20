import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DocsReader from '@/components/docs/DocsReader';
import { DOC_CATALOG, buildDocumentHeadingIdByLine, extractHeadings, getDocBySlug } from '@/lib/docs/catalog';
import { loadDocMarkdown } from '@/lib/docs/load';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return DOC_CATALOG.map(d => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return { title: 'Docs' };
  return {
    title: `${doc.title} — aidea docs`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const content = loadDocMarkdown(slug);
  if (!content) notFound();

  const headings = extractHeadings(content);
  const headingIdByLine = buildDocumentHeadingIdByLine(content);

  return (
    <DocsReader doc={doc} content={content} headings={headings} headingIdByLine={headingIdByLine} />
  );
}
