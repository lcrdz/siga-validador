// @ts-check
// NF-e/NFC-e access key (44 digits), following the national layout:
// cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
import { digitsOnly } from './formats.js';

/** @typedef {import('./types.js').AccessKey} AccessKey */

/**
 * Check digit (modulo 11, weights 2 to 9 from right to left)
 * of the first 43 digits of the key.
 * @param {string} key43
 * @returns {string}
 */
export function checkDigit(key43) {
  let sum = 0;
  let weight = 2;
  for (let i = key43.length - 1; i >= 0; i--) {
    sum += Number(key43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return String(rest < 2 ? 0 : 11 - rest);
}

/**
 * Parses an access key. Accepts spaces and other separators.
 * Returns null when there are not 44 digits.
 * @param {string} input
 * @returns {AccessKey | null}
 */
export function parseAccessKey(input) {
  const accessKey = digitsOnly(input);
  if (accessKey.length !== 44) return null;
  const dv = accessKey.slice(43);
  return {
    accessKey,
    uf: accessKey.slice(0, 2),
    yearMonth: accessKey.slice(2, 6),
    issuerCnpj: accessKey.slice(6, 20),
    model: accessKey.slice(20, 22),
    series: String(Number(accessKey.slice(22, 25))),
    number: String(Number(accessKey.slice(25, 34))),
    emissionType: accessKey.slice(34, 35),
    code: accessKey.slice(35, 43),
    dv,
    checkDigitValid: checkDigit(accessKey.slice(0, 43)) === dv,
  };
}
