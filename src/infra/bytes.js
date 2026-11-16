// @ts-check
// Byte conversions (files travel as base64 between the service worker and the page).

const BLOCK = 0x8000;

/**
 * Each byte becomes one character (to search for markers inside PDFs).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += BLOCK) {
    s += String.fromCharCode.apply(null, /** @type {any} */ (bytes.subarray(i, i + BLOCK)));
  }
  return s;
}

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
export function base64ToBytes(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  return btoa(latin1(bytes));
}
