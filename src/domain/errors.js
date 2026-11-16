// @ts-check
// Known errors of the validation flow. Messages are the ones shown to the user.
import { MESSAGES, STATUS } from './result.js';

/** @typedef {import('./types.js').Status} Status */

export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {ErrorOptions} [options]
   */
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The SIGA page came back without the expected form (session expired). */
export class SessionExpiredError extends ValidationError {
  constructor() {
    super('Não consegui ler o lançamento — a sessão do SIGA pode ter expirado. Recarregue a página.');
  }
}

/** None of the attachment download paths worked. */
export class AttachmentUnavailableError extends ValidationError {}

/** The attachment is not a PDF, JPEG or PNG. */
export class UnsupportedAttachmentError extends ValidationError {
  /** @param {string} name */
  constructor(name) {
    super(`Formato de anexo não suportado (${name})`);
  }
}

/** The SEFAZ firewall blocked the queries; the extension is paused. */
export class SefazBlockedError extends ValidationError {
  /** @param {string} message */
  constructor(message) {
    super(message);
    /** Kept for callers that check `error.blocked`. */
    this.blocked = true;
  }
}

/** The SEFAZ page did not include the invoice data. */
export class SefazNoDataError extends ValidationError {
  /** @param {string} [warning] warning text from the page, if any */
  constructor(warning) {
    super(`A SEFAZ não devolveu os dados da nota${warning ? `: ${warning}` : ''}`);
    this.warning = warning ?? '';
  }
}

/**
 * SEFAZ rejected the QR Code (e.g. a contingency NFC-e whose Digest Value
 * does not match the transmitted invoice).
 */
export class InvalidQrCodeError extends SefazNoDataError {}

/**
 * How each error shows up in the entry result.
 * - SEFAZ blocked: error (can be revalidated after the pause).
 * - QR Code rejected by SEFAZ: manual (revalidating won't help; check by the key).
 * - anything else: error with the message.
 * @param {unknown} error
 * @param {{ accessKey?: string }} [context]  invoice access key, when already read
 * @returns {{ status: Status, message: string, sefazBlocked?: true }}
 */
export function classifyError(error, context = {}) {
  const message = String(/** @type {any} */ (error)?.message || error);
  if (error instanceof SefazBlockedError) return { status: STATUS.ERROR, message, sefazBlocked: true };
  if (error instanceof InvalidQrCodeError)
    return { status: STATUS.MANUAL, message: MESSAGES.qrRejected(context.accessKey) };
  return { status: STATUS.ERROR, message };
}
