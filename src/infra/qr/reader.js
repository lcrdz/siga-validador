// Reads the QR Code in an image: Chrome's native BarcodeDetector, with enlarged
// crops for phone photos, and jsQR as a fallback.
import jsQR from 'jsqr';

/** @typedef {import('../pdf/images.js').ExtractedImage} ExtractedImage */

let detector = null;
async function withBarcodeDetector(source) {
  if (!('BarcodeDetector' in globalThis)) return null;
  try {
    detector = detector || new BarcodeDetector({ formats: ['qr_code'] });
    const found = await detector.detect(source);
    return found[0]?.rawValue || null;
  } catch {
    return null;
  }
}

function withJsQR(cv) {
  if (typeof jsQR !== 'function') return null;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const payload = g.getImageData(0, 0, cv.width, cv.height);
  return jsQR(payload.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' })?.data || null;
}

const MAX_SIDE = 4096;

// Crops a vertical band of the image and resizes it (phone photos often
// have a QR too small to read at the original size).
function crop(bmp, y0, y1, scale) {
  const sy = Math.round(y0 * bmp.height);
  const sh = Math.round((y1 - y0) * bmp.height);
  const e = Math.min(scale, MAX_SIDE / Math.max(bmp.width, sh));
  const cv = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * e)), Math.max(1, Math.round(sh * e)));
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, sy, bmp.width, sh, 0, 0, cv.width, cv.height);
  return cv;
}

// Attempts by cost: original image, then enlarged bands where the QR
// usually is (bottom of the receipt), and finally jsQR.
const ATTEMPTS = [
  [0, 1, 1.5],
  [0.5, 1, 1.5],
  [0.4, 0.9, 1.5],
  [0.5, 1, 2],
  [0, 1, 0.6],
  [0, 0.6, 1.5],
];

/**
 * @param {ExtractedImage} image
 * @returns {Promise<string | null>}  QR Code content, or null
 */
export async function readQr(image) {
  const bmp = await createImageBitmap(new Blob([image.bytes], { type: image.type }));
  try {
    const direct = await withBarcodeDetector(bmp);
    if (direct) return direct;
    for (const [y0, y1, scale] of ATTEMPTS) {
      const cv = crop(bmp, y0, y1, scale);
      const decoded = (await withBarcodeDetector(cv)) || withJsQR(cv);
      if (decoded) return decoded;
    }
    return null;
  } finally {
    bmp.close?.();
  }
}
