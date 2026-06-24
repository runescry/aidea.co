import { extractText, getDocumentProxy } from 'unpdf';

export const DOCUMENT_TEXT_MAX_CHARS = 8000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function capText(text: string): { text: string; truncated: boolean } {
  const truncated = text.length > DOCUMENT_TEXT_MAX_CHARS;
  return { text: text.slice(0, DOCUMENT_TEXT_MAX_CHARS), truncated };
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : String(text ?? '');
}

export async function extractTextFromBuffer(
  bytes: Buffer,
  mimeType: string,
  filename?: string,
): Promise<{ text: string; truncated: boolean }> {
  const mime = mimeType.toLowerCase();
  const name = (filename ?? '').toLowerCase();

  let raw = '';
  if (mime.includes('text/plain') || name.endsWith('.txt')) {
    raw = bytes.toString('utf8');
  } else if (mime.includes('text/html') || name.endsWith('.html') || name.endsWith('.htm')) {
    raw = stripHtml(bytes.toString('utf8'));
  } else if (mime.includes('application/pdf') || name.endsWith('.pdf')) {
    raw = await extractPdfText(bytes);
  } else {
    throw new Error(`Unsupported document type: ${mimeType || filename || 'unknown'}`);
  }

  return capText(raw.trim());
}
