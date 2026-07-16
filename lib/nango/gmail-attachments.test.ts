import { describe, expect, it } from 'vitest';
import { listAttachmentsFromPayload } from './gmail-attachments';
import type { GmailMessagePayload } from './gmail-body';

describe('listAttachmentsFromPayload', () => {
  it('lists attachment metadata from nested MIME parts', () => {
    const payload: GmailMessagePayload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'text/plain',
          body: { data: 'dGV4dA==' },
        },
        {
          mimeType: 'application/pdf',
          filename: 'invoice.pdf',
          body: { attachmentId: 'att-1', size: 2048 },
        } as { mimeType?: string; filename?: string; body?: { attachmentId?: string; size?: number } },
        {
          mimeType: 'multipart/related',
          parts: [
            {
              mimeType: 'application/pdf',
              filename: 'nested.pdf',
              body: { attachmentId: 'att-2', size: 4096 },
            } as { mimeType?: string; filename?: string; body?: { attachmentId?: string; size?: number } },
          ],
        },
      ],
    };

    const attachments = listAttachmentsFromPayload(payload);
    expect(attachments).toEqual([
      {
        attachmentId: 'att-1',
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      },
      {
        attachmentId: 'att-2',
        filename: 'nested.pdf',
        mimeType: 'application/pdf',
        size: 4096,
      },
    ]);
  });
});
