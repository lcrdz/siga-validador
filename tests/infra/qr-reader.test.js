import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeJpeg } from '../helpers/fakes.js';

// jsQR is the reading fallback when the browser has no BarcodeDetector.
const jsQR = vi.hoisted(() => vi.fn());
vi.mock('jsqr', () => ({ default: jsQR }));

const KEY = '35260934346686000199650030001474811104560291';
const QR_ONLINE = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|ABCDEF0123456789ABCDEF0123456789ABCDEF01`;

describe('readQr', () => {
  let attempts;
  let readQr; // reloaded for each test: the module caches the BarcodeDetector it created

  // Mocks createImageBitmap, OffscreenCanvas and BarcodeDetector: each read attempt
  // gets a number; "findIn" says in which one the QR is found.
  function simulateBrowser({ findIn = null, hasBarcodeDetector = true, jsQrFinds = false } = {}) {
    attempts = [];
    const bitmap = { width: 1000, height: 2000, close: vi.fn() };
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(w, h) {
          this.width = w;
          this.height = h;
        }
        getContext() {
          return {
            drawImage: (...args) => {
              this.region = args;
            },
            getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          };
        }
      },
    );
    if (hasBarcodeDetector) {
      vi.stubGlobal(
        'BarcodeDetector',
        class {
          async detect(source) {
            attempts.push(source === bitmap ? 'original' : `recorte ${source.width}x${source.height}`);
            return attempts.length === findIn ? [{ rawValue: QR_ONLINE }] : [];
          }
        },
      );
    } else {
      vi.stubGlobal('BarcodeDetector', undefined);
      delete globalThis.BarcodeDetector;
    }
    jsQR.mockReset().mockReturnValue(jsQrFinds ? { data: QR_ONLINE } : null);
    return bitmap;
  }

  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    ({ readQr } = await import('../../src/infra/qr/reader.js'));
  });

  it('reads straight from the original image when possible', async () => {
    const bitmap = simulateBrowser({ findIn: 1 });
    await expect(readQr({ bytes: fakeJpeg(), type: 'image/jpeg' })).resolves.toBe(QR_ONLINE);
    expect(attempts).toEqual(['original']);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('tries enlarged crops when the direct read fails', async () => {
    simulateBrowser({ findIn: 3 });
    await expect(readQr({ bytes: fakeJpeg(), type: 'image/jpeg' })).resolves.toBe(QR_ONLINE);
    // original, whole page x1.5 and bottom half x1.5
    expect(attempts).toEqual(['original', 'recorte 1500x3000', 'recorte 1500x1500']);
  });

  it('caps the crop size at 4096 px', async () => {
    simulateBrowser({ findIn: 99 });
    await readQr({ bytes: fakeJpeg(), type: 'image/jpeg' });
    const sizes = attempts.slice(1).map((t) => t.replace('recorte ', '').split('x').map(Number));
    expect(Math.max(...sizes.flat())).toBeLessThanOrEqual(4096);
  });

  it('returns null when no attempt finds the QR', async () => {
    const bitmap = simulateBrowser({ findIn: null });
    await expect(readQr({ bytes: fakeJpeg(), type: 'image/jpeg' })).resolves.toBeNull();
    expect(attempts).toHaveLength(7); // original + 6 crops
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('uses jsQR when the browser has no BarcodeDetector', async () => {
    simulateBrowser({ hasBarcodeDetector: false, jsQrFinds: true });
    await expect(readQr({ bytes: fakeJpeg(), type: 'image/jpeg' })).resolves.toBe(QR_ONLINE);
    expect(jsQR).toHaveBeenCalledTimes(1);
  });
});
