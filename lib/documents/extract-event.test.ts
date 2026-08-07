import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getModel: vi.fn(),
  extractTextFromBuffer: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: mocks.generateText }));
vi.mock('@/lib/ai/provider', () => ({ getModel: mocks.getModel }));
vi.mock('./extract-text', () => ({ extractTextFromBuffer: mocks.extractTextFromBuffer }));

import { extractEventFromUpload, isSupportedEventUpload } from './extract-event';

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

describe('extractEventFromUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getModel.mockReturnValue('fake-model');
    mocks.extractTextFromBuffer.mockResolvedValue({ text: 'Sports carnival Friday 5 Sept, 9am at the oval', truncated: false });
  });

  it('sends extracted PDF text as a plain prompt, not an image message', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse({
      title: 'Sports carnival', date: '2026-09-05', time: '09:00', location: 'The oval', description: null,
    }));

    const result = await extractEventFromUpload({
      bytes: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
      filename: 'flyer.pdf',
    });

    expect(result).toEqual({
      title: 'Sports carnival',
      date: '2026-09-05',
      time: '09:00',
      location: 'The oval',
      description: undefined,
    });
    expect(mocks.extractTextFromBuffer).toHaveBeenCalledWith(expect.any(Buffer), 'application/pdf', 'flyer.pdf');
    const [{ messages }] = mocks.generateText.mock.calls[0] as [{ messages: Array<{ content: unknown }> }];
    expect(typeof messages[0].content).toBe('string');
    expect(messages[0].content).toContain('Sports carnival Friday');
  });

  it('sends images as a multimodal message without text extraction', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse({
      title: 'Excursion to the zoo', date: '2026-08-20', time: null, location: null, description: null,
    }));

    const result = await extractEventFromUpload({
      bytes: Buffer.from('image-bytes'),
      mimeType: 'image/jpeg',
      filename: 'flyer.jpg',
    });

    expect(result?.title).toBe('Excursion to the zoo');
    expect(result?.time).toBeUndefined();
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
    const [{ messages }] = mocks.generateText.mock.calls[0] as [{ messages: Array<{ content: unknown }> }];
    expect(Array.isArray(messages[0].content)).toBe(true);
    const content = messages[0].content as Array<{ type: string; mimeType?: string }>;
    expect(content[0]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' });
  });

  it('returns null when the model finds no dated event', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse({ title: null, date: null }));

    const result = await extractEventFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toBeNull();
  });

  it('discards a malformed date instead of returning bad data', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse({ title: 'Something', date: 'next Friday' }));

    const result = await extractEventFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toBeNull();
  });

  it('discards a malformed time but keeps the rest of the event', async () => {
    mocks.generateText.mockResolvedValue(jsonResponse({
      title: 'Assembly', date: '2026-08-10', time: 'morning', location: null, description: null,
    }));

    const result = await extractEventFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    });

    expect(result).toEqual({ title: 'Assembly', date: '2026-08-10', time: undefined, location: undefined, description: undefined });
  });

  it('throws when the model response has no JSON', async () => {
    mocks.generateText.mockResolvedValue({ text: 'I cannot help with that.' });

    await expect(extractEventFromUpload({
      bytes: Buffer.from('x'),
      mimeType: 'application/pdf',
    })).rejects.toThrow(/No JSON/);
  });
});
