import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getModel: vi.fn(),
  extractTextFromBuffer: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: mocks.generateText }));
vi.mock('@/lib/ai/provider', () => ({ getModel: mocks.getModel }));
vi.mock('./extract-text', () => ({ extractTextFromBuffer: mocks.extractTextFromBuffer }));

import { extractEventsFromUpload, isSupportedEventUpload } from './extract-event';

function jsonResponse(obj: unknown) {
  return { text: JSON.stringify(obj) };
}

describe('isSupportedEventUpload', () => {
  it('accepts pdf and common image types by mime or extension', () => {
    expect(isSupportedEventUpload('application/pdf')).toBe(true);
    expect(isSupportedEventUpload('image/jpeg')).toBe(true);
    expect(isSupportedEventUpload('image/png')).toBe(true);
    expect(isSupportedEventUpload('application/octet-stream', 'flyer.pdf')).toBe(true);
    expect(isSupportedEventUpload('application/octet-stream', 'photo.HEIC')).toBe(false);
  });

  it('rejects unsupported types', () => {
    expect(isSupportedEventUpload('application/msword')).toBe(false);
    expect(isSupportedEventUpload('text/plain')).toBe(false);
  });
});

describe('extractEventsFromUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getModel.mockReturnValue('fake-model');
    mocks.extractTextFromBuffer.mockResolvedValue({ text: 'Sports carnival Friday 5 Sept, 9am at the oval', truncated: false });
  });

  it('sends extracted PDF text as a plain prompt, not an image message', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse([
      { title: 'Sports carnival', date: '2026-09-05', time: '09:00', location: 'The oval', description: null },
    ]));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
      filename: 'flyer.pdf',
    });

    expect(result).toEqual([{
      title: 'Sports carnival',
      date: '2026-09-05',
      time: '09:00',
      location: 'The oval',
      description: undefined,
    }]);
    expect(mocks.extractTextFromBuffer).toHaveBeenCalledWith(expect.any(Buffer), 'application/pdf', 'flyer.pdf');
    const [{ messages }] = mocks.generateText.mock.calls[0] as [{ messages: Array<{ content: unknown }> }];
    expect(typeof messages[0].content).toBe('string');
    expect(messages[0].content).toContain('Sports carnival Friday');
  });

  it('sends images as a multimodal message without text extraction', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse([
      { title: 'Excursion to the zoo', date: '2026-08-20', time: null, location: null, description: null },
    ]));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('image-bytes'),
      mimeType: 'image/jpeg',
      filename: 'flyer.jpg',
    });

    expect(result[0]?.title).toBe('Excursion to the zoo');
    expect(result[0]?.time).toBeUndefined();
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
    const [{ messages }] = mocks.generateText.mock.calls[0] as [{ messages: Array<{ content: unknown }> }];
    expect(Array.isArray(messages[0].content)).toBe(true);
    const content = messages[0].content as Array<{ type: string; mimeType?: string }>;
    expect(content[0]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' });
  });

  it('extracts multiple events from a single document, in order', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse([
      { title: 'Biennial Music Concert', date: '2026-08-10', time: '18:00', location: 'Melbourne Recital Centre', description: 'Meet in foyer for roll call' },
      { title: 'Late start', date: '2026-08-11', time: '09:35', location: null, description: 'Classes commence at 9:35am' },
    ]));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe('Biennial Music Concert');
    expect(result[1]?.title).toBe('Late start');
    expect(result[1]?.date).toBe('2026-08-11');
  });

  it('drops individual malformed events but keeps the valid ones', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse([
      { title: 'Valid event', date: '2026-08-10', time: '09:00' },
      { title: 'Bad date', date: 'next Friday' },
      { title: null, date: '2026-08-12' },
    ]));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toEqual([{ title: 'Valid event', date: '2026-08-10', time: '09:00', location: undefined, description: undefined }]);
  });

  it('caps the number of events returned', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse(
      Array.from({ length: 12 }, (_, i) => ({ title: `Event ${i}`, date: '2026-08-10', time: '09:00' })),
    ));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toHaveLength(8);
  });

  it('returns an empty array when the model finds no dated event', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse([]));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toEqual([]);
  });

  it('wraps a single stray object response instead of failing', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse({ title: 'Assembly', date: '2026-08-10', time: null }));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toEqual([{ title: 'Assembly', date: '2026-08-10', time: undefined, location: undefined, description: undefined }]);
  });

  it('discards a malformed time but keeps the rest of the event', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse([
      { title: 'Assembly', date: '2026-08-10', time: 'morning', location: null, description: null },
    ]));

    const result = await extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toEqual([{ title: 'Assembly', date: '2026-08-10', time: undefined, location: undefined, description: undefined }]);
  });

  it('throws when the model response has no JSON', async () => {
    mocks.generateText.mockResolvedValue({ text: 'I cannot help with that.' });

    await expect(extractEventsFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    })).rejects.toThrow(/No JSON/);
  });
});
