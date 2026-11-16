// @ts-check
// Parsing (no network) of SIGA pages and responses.
import { digitsOnly } from '../../domain/formats.js';
import { SessionExpiredError } from '../../domain/errors.js';
import { htmlToText } from '../text.js';

/** @typedef {import('../../domain/types.js').Entry} Entry */

/**
 * @typedef {Object} Attachment
 * @property {string} code
 * @property {string} name
 * @property {string} [size]
 */

/**
 * Converts the columns of an expenses grid row (as DataTables stores them).
 * Columns: 0 date, 1 entry, 2 doc. no., 3 supplier, 4 expense, 5 amount,
 * 6 fine, 7 interest, 8 total, 9 "Opções" menu (with data-codigo).
 * @param {string[]} c
 * @returns {Entry}
 */
export function rowToEntry(c) {
  const code = (/data-codigo\s*=\s*["']([^"']+)["']/i.exec(c[9] || '') || [])[1];
  return {
    code: /** @type {string} */ (code),
    date: htmlToText(c[0]),
    number: htmlToText(c[1]),
    docNumber: htmlToText(c[2]),
    supplier: htmlToText(c[3]),
    expense: htmlToText(c[4]),
    amount: htmlToText(c[5]),
    total: htmlToText(c[8]),
  };
}

/**
 * Fallback: reads only the visible table rows (when the bridge does not answer).
 * @param {ParentNode} doc
 * @returns {Entry[]}
 */
export function entriesFromTable(doc) {
  return [...doc.querySelectorAll('table tbody tr')]
    .filter((tr) => tr.querySelector('a.visualizar[data-codigo]'))
    .map((tr) => {
      const c = [.../** @type {HTMLTableRowElement} */ (tr).cells].map((td) => td.innerHTML);
      c[9] = /** @type {Element} */ (tr.querySelector('a.visualizar')).outerHTML;
      return rowToEntry(c);
    });
}

/**
 * Entry detail (TES00804 › Visualizar).
 * @param {string} html
 * @returns {Partial<Entry>}
 */
export function parseDetail(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  /** @param {string} id */
  const v = (id) => {
    const field = /** @type {HTMLInputElement | null} */ (doc.getElementById(id));
    return (field?.value || '').trim();
  };
  if (!doc.getElementById('f_documento')) throw new SessionExpiredError();
  const supplier = v('f_fornecedor');
  return {
    documentDate: v('f_datadocumento'),
    documentType: v('f_tipodocumento'),
    docNumber: v('f_documento'),
    amount: v('f_valor'),
    supplier,
    supplierCnpj: digitsOnly((/\[([^\]]+)\]\s*$/.exec(supplier) || [])[1]),
    description: v('f_historico'),
    remarks: v('f_observacao'),
    entryDate: v('f_data'),
    account: v('f_conta'),
  };
}

/**
 * Response of the GED/ArquivoWS.asmx/Selecionar service.
 * @param {{ d?: Array<{ Codigo: string, Nome: string, TamanhoKB?: string }> }} json
 * @returns {Attachment[]}
 */
export function listAttachments(json) {
  return (json.d || []).map((a) => ({ code: a.Codigo, name: a.Nome, size: a.TamanhoKB }));
}

export const BLOB_URL = /https:\/\/[a-z0-9-]+\.blob\.core\.windows\.net\/[^'"\s<>]+/i;

/**
 * Attachment viewer (GED99902): file URL and headers signed by SIGA.
 * @param {string} html
 * @returns {{ url: string, headers: Record<string, string> } | null}
 */
export function parseViewer(html) {
  const url = (/\.open\(\s*["']GET["']\s*,\s*["']([^"']+)["']/i.exec(html) || [])[1] || (BLOB_URL.exec(html) || [])[0];
  if (!url) return null;
  /** @type {Record<string, string>} */
  const headers = {};
  for (const m of html.matchAll(/setRequestHeader\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']\s*\)/gi)) {
    headers[m[1]] = m[2];
  }
  return { url: url.replace(/&amp;/g, '&'), headers };
}

/**
 * Download link (GED99901): file URL in storage, without authorization.
 * @param {string} html
 * @returns {string | null}
 */
export function downloadUrl(html) {
  const m = BLOB_URL.exec(html);
  return m ? m[0].replace(/&amp;/g, '&') : null;
}

/**
 * File type from the signature of the first bytes.
 * @param {Uint8Array} b
 * @returns {'application/pdf' | 'image/jpeg' | 'image/png' | null}
 */
export function typeFromSignature(b) {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  return null;
}

/**
 * Work month shown in the SIGA header ("09/2026").
 * @param {string} pageText
 * @returns {string}
 */
export function workMonth(pageText) {
  const m = /M[eê]s de Trabalho\s*(\d{2}\/\d{4})/i.exec(pageText.slice(0, 4000));
  return m ? m[1] : '';
}
