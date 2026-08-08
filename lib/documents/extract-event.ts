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

/** Hard cap on events per upload — bounds LLM output size and how many calendar writes one
 *  upload can trigger. A prompt instruction asks the model to stay under this too. */
const MAX_EVENTS_PER_UPLOAD = 8;

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
  return `You are extracting calendar events from a school document — a flyer, permission form, or newsletter excerpt. Documents like this often describe more than one dated item (e.g. an event plus a related late-start or schedule change the next day) — find ALL of them, up to ${MAX_EVENTS_PER_UPLOAD}.

Respond with ONLY valid JSON, no markdown and no preamble: an array of objects, one per event, in exactly this shape:
[{"title": "short event title", "date": "YYYY-MM-DD", "time": "HH:MM 24h or null", "location": "string or null", "description": "one short sentence or null"}]

Today's date is ${referenceDate} — resolve relative dates ("next Friday", "this Thursday") against it. If a date is stated as an arrival/meet time rather than a start time, use it anyway — it's the only clock time given. If the document describes no dated event at all, respond with an empty array: []`;
}

interface RawExtraction {
  title?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  description?: string | null;
}

function extractJSON(text: string): unknown {
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  const useArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const start = useArray ? arrStart : objStart;
  const end = useArray ? text.lastIndexOf(']') : text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in model response: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function normalizeEvent(item: unknown): ExtractedEvent | null {
  // The model may return null/a bare string/etc. alongside valid events for an item it can't
  // parse — treat that as "drop this one" rather than letting property access throw and lose
  // every event already collected in this batch.
  if (!item || typeof item !== 'object') return null;
  const raw = item as RawExtraction;
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

export async function extractEventsFromUpload(input: {
  bytes: Buffer;
  mimeType: string;
  filename?: string;
  /** Defaults to today (UTC) — pass the caller's local date for correct relative-date resolution. */
  referenceDate?: string;
}): Promise<ExtractedEvent[]> {
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
    maxTokens: 1500,
  });

  const raw = extractJSON(text);
  const rawEvents = Array.isArray(raw) ? raw : [raw];

  const events: ExtractedEvent[] = [];
  for (const item of rawEvents) {
    const normalized = normalizeEvent(item);
    if (normalized) events.push(normalized);
  }
  return events.slice(0, MAX_EVENTS_PER_UPLOAD);
}
