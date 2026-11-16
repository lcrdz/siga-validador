// @ts-check
// Matching rules between the SIGA entry and the invoice.
import { formatCnpj, normalizeText, brNumber, digitsOnly } from './formats.js';

/** @typedef {import('./types.js').Entry} Entry */
/** @typedef {import('./types.js').SefazInvoice} SefazInvoice */
/** @typedef {import('./types.js').Config} Config */
/** @typedef {import('./types.js').Criterion} Criterion */
/** @typedef {import('./types.js').Checks} Checks */

/** @type {Readonly<Config>} */
export const DEFAULT_CONFIG = Object.freeze({ consumerCnpj: '61.526.398/0001-99', paymentMethod: 'Dinheiro' });

/** Criteria in the order of the panel columns. @type {ReadonlyArray<Criterion>} */
export const CRITERIA = Object.freeze([
  { id: 'amount', label: 'Valor' },
  { id: 'cnpj', label: 'CNPJ' },
  { id: 'payment', label: 'Pagto' },
  { id: 'date', label: 'Data' },
  { id: 'number', label: 'Nº' },
]);

/**
 * Compares the entry with the invoice on each criterion.
 * @param {Entry} entry
 * @param {SefazInvoice} invoice
 * @param {Config} cfg
 * @returns {Checks}
 */
export function compare(entry, invoice, cfg) {
  const methods = invoice.payments.map((p) => p.method);
  return {
    amount: {
      ok: Math.abs(brNumber(entry.amount) - brNumber(invoice.amount)) < 0.005,
      siga: entry.amount,
      invoice: invoice.amount || '—',
    },
    cnpj: {
      ok: digitsOnly(invoice.consumer) === digitsOnly(cfg.consumerCnpj),
      siga: formatCnpj(cfg.consumerCnpj),
      invoice: invoice.consumer ? `${invoice.consumerType} ${invoice.consumer}` : 'não identificado',
    },
    payment: {
      ok: methods.length > 0 && methods.every((f) => normalizeText(f) === normalizeText(cfg.paymentMethod)),
      siga: cfg.paymentMethod,
      invoice: methods.join(' + ') || '—',
    },
    date: {
      ok: entry.documentDate === invoice.issueDate,
      siga: entry.documentDate ?? '',
      invoice: invoice.issueDate || '—',
    },
    number: {
      ok: Number(digitsOnly(entry.docNumber)) === Number(invoice.number),
      siga: entry.docNumber,
      invoice: invoice.number || '—',
    },
  };
}

/**
 * @param {Checks} checks
 * @returns {boolean}
 */
export function allMatch(checks) {
  return Object.values(checks).every((c) => c.ok);
}

/**
 * Warning when the invoice issuer is not the entry supplier.
 * @param {string | undefined} supplierCnpj  digits only
 * @param {string | undefined} issuerCnpj    digits only
 * @returns {string | undefined}
 */
export function issuerWarning(supplierCnpj, issuerCnpj) {
  if (supplierCnpj && issuerCnpj && supplierCnpj !== issuerCnpj) {
    return `Emitente da nota (${formatCnpj(issuerCnpj)}) diferente do fornecedor do lançamento.`;
  }
  return undefined;
}
