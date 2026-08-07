import { generateText } from 'ai';
import { getModel } from '@/lib/ai/provider';
import { extractTextFromBuffer } from './extract-text';

export interface ExtractedEvent {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24h — absent when the document doesn't state a time. */
  time?: string;
  location?: string;
  description?: string;
}

const SUPPORTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

function isImage(mimeType: string, filename?: string): boolean {
  const mime = mimeType.toLowerCase();
  if (SUPPORTED_IMAGE_MIME.has(mime)) return true;
  return IMAGE_EXTENSION.test(filename ?? '');
}

export function isSupportedEventUpload(mimeType: string, filename?: string): boolean {
  if (isImage(mimeType, filename)) return true;
  const mime = mimeType.toLowerCase();
  const name = (filename ?? '').toLowerCase();
  return mime.includes('application/pdf') || name.endsWith('.pdf');
}

function buildPrompt(referenceDate: string): string {
  return `You are extracting a single calendar event from a school document — a flyer, permission form, or newsletter excerpt.

Find the ONE most prominent dated event described (e.g. an excursion, sports day, incursion, due date). Respond with ONLY valid JSON, no markdown and no preamble, in exactly this shape:
{"title": "short event title or null", "date": "YYYY-MM-DD or null", "time": "HH:MM 24h or null", "location": "string or null", "description": "one short sentence or null"}

Today's date is ${referenceDate} — resolve relative dates ("next Friday", "this Thursday") against it. If the document does not clearly describe a single dated event, respond with {"title": null, "date": null}.`;
}

interface RawExtraction {
  title: string | null;
  date: string | null;
  time?: string | null;
  location?: string | null;
  description?: string | null;
}

function extractJSON(text: string): RawExtraction {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in model response: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as RawExtraction;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

export async function extractEventFromUpload(input: {
  bytes: Buffer;
  mimeType: string;
  filename?: string;
  /** Defaults to today (UTC) — pass the caller's local date for correct relative-date resolution. */
  referenceDate?: string;
}): Promise<ExtractedEvent | null> {
  const { bytes, mimeType, filename } = input;
  const referenceDate = input.referenceDate ?? new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(referenceDate);

  const messages = isImage(mimeType, filename)
    ? [{
        role: 'user' as const,
        content: [
          { type: 'image' as const, image: bytes, mimeType },
          { type: 'text' as const, text: prompt },
        ],
      }]
    : [{
        role: 'user' as const,
        content: `${prompt}\n\nDOCUMENT TEXT:\n${(await extractTextFromBuffer(bytes, mimeType, filename)).text}`,
      }];

  const { text } = await generateText({
    model: getModel(),
    messages,
    maxTokens: 500,
  });

  const raw = extractJSON(text);
  if (!raw.title?.trim() || !raw.date || !DATE_RE.test(raw.date)) return null;

  const time = raw.time?.trim();
  return {
    title: raw.title.trim(),
    date: raw.date,
    time: time && TIME_RE.test(time) ? time.padStart(5, '0') : undefined,
    location: raw.location?.trim() || undefined,
    description: raw.description?.trim() || undefined,
  };
}
