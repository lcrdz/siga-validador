// @ts-check
// Possible entry statuses and building of the validation result.
import { allMatch } from './rules.js';

/** @typedef {import('./types.js').Entry} Entry */
/** @typedef {import('./types.js').Result} Result */
/** @typedef {import('./types.js').Status} Status */
/** @typedef {import('./types.js').Checks} Checks */

/** @type {Readonly<{ OK: 'ok', DIVERGENT: 'divergent', MANUAL: 'manual', ERROR: 'error' }>} */
export const STATUS = Object.freeze({ OK: 'ok', DIVERGENT: 'divergent', MANUAL: 'manual', ERROR: 'error' });

/** Labels shown in the panel and in the CSV ("pending" = still queued). */
export const STATUS_LABEL = Object.freeze({
  ok: 'OK',
  divergent: 'Divergente',
  manual: 'Manual',
  error: 'Erro',
  pending: 'Na fila',
});

export const MESSAGES = Object.freeze({
  noAttachment: 'Lançamento sem nota anexada.',
  receipt: 'Recibo — sem QR Code para consultar.',
  noQr: 'QR Code de NFC-e não encontrado (pode ser NF-e modelo 55 ou scan ilegível).',
  /** @param {string} host */
  otherSefaz: (host) => `NFC-e de outra SEFAZ (${host}). Abra a consulta para conferir.`,
  /** @param {string} [accessKey] */
  qrRejected: (accessKey) =>
    'A SEFAZ recusou o QR Code (nota emitida em contingência com dados inconsistentes). ' +
    `Confira pela chave de acesso${accessKey ? `: ${formatAccessKey(accessKey)}` : ''}.`,
});

/**
 * Key in groups of 4 digits, as printed on invoices.
 * @param {string} accessKey
 * @returns {string}
 */
export function formatAccessKey(accessKey) {
  return accessKey.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Initial result (status "error" until validation finishes).
 * @param {Entry} entry
 * @returns {Result}
 */
export function newResult(entry) {
  return { entry: { ...entry }, status: STATUS.ERROR, message: '', checks: null, imageUrl: null, queryUrl: null };
}

/**
 * Final status once the invoice was compared.
 * @param {Checks} checks
 * @returns {Status}
 */
export function statusFromChecks(checks) {
  return allMatch(checks) ? STATUS.OK : STATUS.DIVERGENT;
}

/**
 * Status when there is no NFC-e QR Code in the attachment.
 * @param {string | undefined} documentType
 * @returns {{ status: Status, message: string }}
 */
export function noQrCode(documentType) {
  return { status: STATUS.MANUAL, message: /RECIBO/i.test(documentType ?? '') ? MESSAGES.receipt : MESSAGES.noQr };
}
