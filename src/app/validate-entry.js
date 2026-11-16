// @ts-check
// Use case: validate one entry.
// SIGA detail → attachments → QR Code → SEFAZ query → matching rules.
// Dependencies (SIGA, image/QR reading, SEFAZ) are passed in.
import { parseQr } from '../domain/nfce-qrcode.js';
import { issuerWarning, compare } from '../domain/rules.js';
import { MESSAGES, STATUS, newResult, noQrCode, statusFromChecks } from '../domain/result.js';
import { classifyError } from '../domain/errors.js';

/** @typedef {import('../domain/types.js').Entry} Entry */
/** @typedef {import('../domain/types.js').Config} Config */
/** @typedef {import('../domain/types.js').Result} Result */
/** @typedef {import('../domain/types.js').NfceQr} NfceQr */
/** @typedef {import('../infra/pdf/images.js').ExtractedImage} ExtractedImage */

/**
 * @typedef {Object} ValidatorDeps
 * @property {Pick<import('../infra/siga/client.js').SigaClient, 'detail' | 'attachments' | 'downloadAttachment'>} siga
 * @property {(file: { type: string, bytes: Uint8Array }) => ExtractedImage[]} imagesFromFile
 * @property {(image: ExtractedImage) => Promise<string | null>} readQr
 * @property {Pick<import('../infra/sefaz/client.js').SefazClient, 'supports' | 'query'>} sefaz
 * @property {(image: ExtractedImage) => string} [imageUrlFor]  URL for the invoice viewer
 */

/** @param {ExtractedImage} img */
const defaultImageUrlFor = (img) =>
  URL.createObjectURL(new Blob([/** @type {BlobPart} */ (img.bytes)], { type: img.type }));

/**
 * @param {ValidatorDeps} deps
 * @returns {(entry: Entry, cfg: Config) => Promise<Result>}
 */
export function createValidator({ siga, imagesFromFile, readQr, sefaz, imageUrlFor = defaultImageUrlFor }) {
  /**
   * First valid NFC-e QR Code in the attachments; keeps the first page image
   * for the viewer.
   * @param {import('../infra/siga/parsers.js').Attachment[]} attachments
   * @param {Result} res
   * @returns {Promise<NfceQr | null>}
   */
  async function findQr(attachments, res) {
    for (const attachment of attachments) {
      const imgs = imagesFromFile(await siga.downloadAttachment(attachment));
      if (!res.imageUrl && imgs[0]) res.imageUrl = imageUrlFor(imgs[0]);
      for (const img of imgs) {
        const decoded = await readQr(img);
        if (!decoded) continue;
        const qr = parseQr(decoded);
        if (qr.valid) return qr;
      }
    }
    return null;
  }

  return async function validate(base, cfg) {
    const res = newResult(base);
    /** @type {NfceQr | null} */
    let qr = null;
    try {
      Object.assign(res.entry, await siga.detail(base.code));
      const entry = res.entry;

      const attachments = await siga.attachments(base.code);
      if (!attachments.length) {
        res.status = STATUS.DIVERGENT;
        res.message = MESSAGES.noAttachment;
        return res;
      }

      qr = await findQr(attachments, res);
      if (!qr) {
        Object.assign(res, noQrCode(entry.documentType));
        return res;
      }

      res.queryUrl = qr.url ?? null;
      if (!sefaz.supports(qr)) {
        res.status = STATUS.MANUAL;
        res.message = MESSAGES.otherSefaz(qr.host ?? '');
        return res;
      }

      const invoice = await sefaz.query(qr);
      res.invoice = invoice;
      res.checks = compare(entry, invoice, cfg);
      res.status = statusFromChecks(res.checks);
      const warning = issuerWarning(entry.supplierCnpj, invoice.issuerCnpj || qr.issuerCnpj);
      if (warning) res.warning = warning;
    } catch (e) {
      Object.assign(res, classifyError(e, { accessKey: qr?.accessKey }));
    }
    return res;
  };
}
