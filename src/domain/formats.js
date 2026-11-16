// @ts-check
// Text and number conversions in the format used by SIGA and SEFAZ.

/**
 * Keeps only the digits.
 * @param {unknown} s
 * @returns {string}
 */
export function digitsOnly(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Converts a Brazilian-format amount ("1.234,56", "R$ 26,36") to a number.
 * Returns NaN when there is no number.
 * @param {unknown} s
 * @returns {number}
 */
export function brNumber(s) {
  if (s == null) return NaN;
  const cleaned = String(s).replace(/[^\d,.-]/g, '');
  if (!cleaned) return NaN;
  return Number(cleaned.replace(/\./g, '').replace(',', '.'));
}

/**
 * Formats a CNPJ (00.000.000/0000-00). Returns the input when it does not have 14 digits.
 * @param {string | null | undefined} s
 * @returns {string}
 */
export function formatCnpj(s) {
  const d = digitsOnly(s);
  if (d.length !== 14) return s || '';
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Normalizes for comparison: no accents, trimmed, lowercase.
 * @param {unknown} s
 * @returns {string}
 */
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}
