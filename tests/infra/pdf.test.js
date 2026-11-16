import { describe, it, expect } from 'vitest';
import { imagesFromFile, jpegsFromPdf } from '../../src/infra/pdf/images.js';
import { pdfWithJpegs, fakeJpeg } from '../helpers/fakes.js';

describe('imagesFromFile', () => {
  it('extracts the JPEG of a one-page scanned PDF', () => {
    const jpg = fakeJpeg(7);
    const imgs = imagesFromFile({ type: 'application/pdf', bytes: pdfWithJpegs([jpg]) });
    expect(imgs).toHaveLength(1);
    expect(imgs[0].type).toBe('image/jpeg');
    expect([...imgs[0].bytes]).toEqual([...jpg]);
  });

  it('extracts every page, in order', () => {
    const imgs = imagesFromFile({
      type: 'application/pdf',
      bytes: pdfWithJpegs([fakeJpeg(1), fakeJpeg(2), fakeJpeg(3)]),
    });
    expect(imgs.map((i) => i.bytes[6])).toEqual([1, 2, 3]);
  });

  it('works with CRLF line breaks', () => {
    const jpg = fakeJpeg(9);
    const imgs = imagesFromFile({ type: 'application/pdf', bytes: pdfWithJpegs([jpg], { lineBreak: '\r\n' }) });
    expect([...imgs[0].bytes]).toEqual([...jpg]);
  });

  it('uses loose JPEG markers when there is no /DCTDecode', () => {
    const jpg = fakeJpeg(5);
    const pdf = pdfWithJpegs([jpg]);
    const unfiltered = new TextDecoder('latin1').decode(pdf).replace('/DCTDecode', '/XXXDecode');
    const bytes = Uint8Array.from(unfiltered, (c) => c.charCodeAt(0));
    const imgs = imagesFromFile({ type: 'application/pdf', bytes });
    expect(imgs).toHaveLength(1);
    expect([...imgs[0].bytes]).toEqual([...jpg]);
  });

  it('returns an empty list for a PDF without images', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Font /F1 >> endobj\n%%EOF');
    expect(imagesFromFile({ type: 'application/pdf', bytes })).toEqual([]);
  });

  it('returns the image itself when the attachment is not a PDF', () => {
    const bytes = fakeJpeg();
    expect(imagesFromFile({ type: 'image/png', bytes })).toEqual([{ bytes, type: 'image/png' }]);
  });
});

describe('jpegsFromPdf', () => {
  it('returns the bytes of each JPEG', () => {
    expect(jpegsFromPdf(pdfWithJpegs([fakeJpeg(1), fakeJpeg(2)])).map((b) => b[6])).toEqual([1, 2]);
  });
});
