import { describe, expect, it } from 'vitest';
import { DOCUMENT_TEXT_MAX_CHARS, extractTextFromBuffer } from './extract-text';

const MINIMAL_PDF = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 44>>stream
BT /F1 24 Tf 100 700 Td (Hello PDF) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000229 00000 n 
0000000306 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
398
%%EOF`);

describe('extractTextFromBuffer', () => {
  it('extracts plain text', async () => {
    const { text, truncated } = await extractTextFromBuffer(
      Buffer.from('Line one\nLine two'),
      'text/plain',
    );
    expect(text).toBe('Line one\nLine two');
    expect(truncated).toBe(false);
  });

  it('strips HTML', async () => {
    const { text } = await extractTextFromBuffer(
      Buffer.from('<p>Hello <strong>world</strong></p>'),
      'text/html',
    );
    expect(text).toBe('Hello world');
  });

  it('extracts text from a minimal PDF', async () => {
    const { text } = await extractTextFromBuffer(MINIMAL_PDF, 'application/pdf', 'test.pdf');
    expect(text).toContain('Hello PDF');
  });

  it('caps output at 8000 chars', async () => {
    const long = 'z'.repeat(10_000);
    const { text, truncated } = await extractTextFromBuffer(Buffer.from(long), 'text/plain');
    expect(text.length).toBe(DOCUMENT_TEXT_MAX_CHARS);
    expect(truncated).toBe(true);
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      extractTextFromBuffer(Buffer.from('data'), 'application/zip', 'file.zip'),
    ).rejects.toThrow(/Unsupported document type/);
  });
});
