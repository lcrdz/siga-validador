// @ts-check
// CSV export of the check (";" separator and UTF-8 BOM, so it opens directly in Excel).
import { CRITERIA } from './rules.js';
import { STATUS_LABEL } from './result.js';

/** @typedef {import('./types.js').Entry} Entry */
/** @typedef {import('./types.js').Result} Result */

export const CSV_HEADER = Object.freeze([
  'Lançamento',
  'Data',
  'Nº documento',
  'Fornecedor',
  'Valor SIGA',
  'Valor nota',
  'Consumidor na nota',
  'Pagamento na nota',
  'Data da nota',
  'Nº da nota',
  'Status',
  'Observações',
]);

/**
 * @param {unknown} v
 * @returns {string}
 */
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * One row per entry already checked, in list order.
 * @param {Entry[]} entries
 * @param {Map<string, Result>} results  by entry number
 * @returns {string}
 */
export function buildCsv(entries, results) {
  /** @type {unknown[][]} */
  const rows = [[...CSV_HEADER]];
  for (const l of entries) {
    const r = results.get(l.number);
    if (!r) continue;
    const k = r.checks;
    const obs = [];
    if (k) for (const c of CRITERIA) if (!k[c.id].ok) obs.push(`${c.label} divergente`);
    if (r.message) obs.push(r.message);
    if (r.warning) obs.push(r.warning);
    rows.push([
      l.number,
      r.entry.documentDate || l.date,
      r.entry.docNumber || l.docNumber,
      l.supplier,
      r.entry.amount || l.amount,
      k?.amount.invoice || '',
      k?.cnpj.invoice || '',
      k?.payment.invoice || '',
      k?.date.invoice || '',
      k?.number.invoice || '',
      STATUS_LABEL[r.status],
      obs.join('; '),
    ]);
  }
  return '﻿' + rows.map((ls) => ls.map(cell).join(';')).join('\r\n');
}

/**
 * @param {string} [month]  "09/2026"
 * @returns {string}
 */
export function csvFileName(month) {
  return `validacao-despesas-${(month || 'siga').replace('/', '-')}.csv`;
}
