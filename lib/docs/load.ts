import fs from 'fs';
import path from 'path';
import { getDocBySlug } from './catalog';

export function loadDocMarkdown(slug: string): string | null {
  const entry = getDocBySlug(slug);
  if (!entry) return null;
  const filePath = path.join(process.cwd(), entry.file);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
