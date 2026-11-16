// @ts-check
// Extracts the images of an attachment: scanned PDF (one JPEG per page) or the photo itself.
import { latin1 } from '../bytes.js';

/** @typedef {{ bytes: Uint8Array, type: string }} ExtractedImage */

/**
 * Scanner PDFs store each page as a whole JPEG (/DCTDecode).
 * @param {Uint8Array} bytes
 * @returns {Uint8Array[]}
 */
export function jpegsFromPdf(bytes) {
  const s = latin1(bytes);
  const found = [];
  let i = 0;
  while ((i = s.indexOf('/DCTDecode', i)) !== -1) {
    const kw = s.indexOf('stream', i);
    if (kw < 0) break;
    let startIdx = kw + 6;
    if (s[startIdx] === '\r') startIdx++;
    if (s[startIdx] === '\n') startIdx++;
    const endKw = s.indexOf('endstream', startIdx);
    if (endKw < 0) break;
    let end = endKw;
    while (end > startIdx && (s[end - 1] === '\n' || s[end - 1] === '\r')) end--;
    if (bytes[startIdx] === 0xff && bytes[startIdx + 1] === 0xd8) found.push(bytes.slice(startIdx, end));
    i = endKw;
  }
  // Fallback: look for loose JPEG markers.
  if (!found.length) {
    const startIdx = s.indexOf('\xFF\xD8\xFF');
    const end = s.lastIndexOf('\xFF\xD9');
    if (startIdx >= 0 && end > startIdx) found.push(bytes.slice(startIdx, end + 2));
  }
  return found;
}

/**
 * @param {{ type: string, bytes: Uint8Array }} file
 * @returns {ExtractedImage[]}
 */
export function imagesFromFile(file) {
  if (file.type === 'application/pdf') {
    return jpegsFromPdf(file.bytes).map((b) => ({ bytes: b, type: 'image/jpeg' }));
  }
  return [{ bytes: file.bytes, type: file.type }];
}
