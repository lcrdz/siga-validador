// @ts-check
// Parsing of the NFC-e QR Code content (national standard, version 2).
import { parseAccessKey } from './access-key.js';
import { digitsOnly } from './formats.js';

/** @typedef {import('./types.js').NfceQr} NfceQr */

/**
 * @param {string} pageContent  text read from the QR Code
 * @returns {NfceQr}
 */
export function parseQr(pageContent) {
  let url;
  try {
    url = new URL(pageContent.trim());
  } catch {
    return { valid: false };
  }
  const p = url.searchParams.get('p') || url.searchParams.get('chNFe') || '';
  const accessKey = digitsOnly(p.split('|')[0]);
  /** @type {NfceQr} */
  const info = { valid: accessKey.length === 44, url: url.href, host: url.host.toLowerCase(), accessKey };
  const payload = parseAccessKey(accessKey);
  if (payload) {
    info.uf = payload.uf;
    info.yearMonth = payload.yearMonth;
    info.issuerCnpj = payload.issuerCnpj;
    info.model = payload.model;
    info.series = payload.series;
    info.number = payload.number;
    info.emissionType = payload.emissionType;
    info.contingency = payload.emissionType === '9';
    info.checkDigitValid = payload.checkDigitValid;
  }
  return info;
}
