// @ts-check
// Access to SIGA through the session already open in the browser. Read-only
// (no request changes data).
import { SIGA } from '../../config.js';
import { AttachmentUnavailableError, UnsupportedAttachmentError } from '../../domain/errors.js';
import { base64ToBytes } from '../bytes.js';
import { fetchViaExtension as defaultFetchViaExtension } from '../messages.js';
import {
  entriesFromTable,
  listAttachments,
  parseDetail,
  parseViewer,
  rowToEntry,
  typeFromSignature,
  downloadUrl,
} from './parsers.js';

/** @typedef {import('../../domain/types.js').Entry} Entry */
/** @typedef {import('./parsers.js').Attachment} Attachment */
/** @typedef {{ name: string, type: string, bytes: Uint8Array }} FileData */

/**
 * @param {Object} [deps]
 * @param {typeof fetch} [deps.fetch]
 * @param {typeof defaultFetchViaExtension} [deps.fetchViaExtension]  fetch through the service worker (CORS)
 * @param {Window} [deps.win]
 * @param {number} [deps.bridgeTimeoutMs]
 */
export function createSigaClient({
  fetch: request = (...a) => globalThis.fetch(...a),
  fetchViaExtension = defaultFetchViaExtension,
  win = window,
  bridgeTimeoutMs = SIGA.BRIDGE_TIMEOUT_MS,
} = {}) {
  /**
   * All entries loaded in the grid, including other pages,
   * read from DataTables through the bridge (bridge.js). Without an answer, reads the visible table.
   * @returns {Promise<Entry[]>}
   */
  function getEntries() {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      const onReceive = (/** @type {MessageEvent} */ e) => {
        if (e.source !== win || e.data?.__sigaValidador !== 'rows' || e.data.id !== id) return;
        win.removeEventListener('message', onReceive);
        clearTimeout(timer);
        /** @type {string[][] | null} */
        const rows = e.data.rows;
        resolve(rows ? rows.map(rowToEntry).filter((l) => l.code) : entriesFromTable(win.document));
      };
      const timer = setTimeout(() => {
        win.removeEventListener('message', onReceive);
        resolve(entriesFromTable(win.document));
      }, bridgeTimeoutMs);
      win.addEventListener('message', onReceive);
      win.postMessage({ __sigaValidador: 'requestRows', id }, '*');
    });
  }

  /** @param {string} code */
  async function detail(code) {
    const r = await request(`/TES/TES00804.aspx?codigo=${encodeURIComponent(code)}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`SIGA respondeu HTTP ${r.status} ao abrir o lançamento`);
    return parseDetail(await r.text());
  }

  /**
   * @param {string} code
   * @returns {Promise<Attachment[]>}
   */
  async function attachments(code) {
    const r = await request('/GED/ArquivoWS.asmx/Selecionar', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ origem: SIGA.ATTACHMENT_ORIGIN, codigoOrigem: code }),
    });
    if (!r.ok) throw new Error(`SIGA respondeu HTTP ${r.status} ao listar anexos`);
    return listAttachments(await r.json());
  }

  /**
   * @param {string} url
   * @param {Record<string, string>} [headers]
   * @returns {Promise<Uint8Array>}
   */
  async function downloadFromBlob(url, headers = {}) {
    let status = 0;
    try {
      const r = await request(url, { credentials: 'omit', headers: headers, cache: 'no-store' });
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
      status = r.status;
    } catch {
      /* CORS or network: try through the service worker */
    }
    if (status === 404 || status === 403) throw new Error(`armazenamento respondeu HTTP ${status}`);
    return base64ToBytes(await fetchViaExtension(url, 'base64', headers));
  }

  // Main path: the same page SIGA uses for the preview magnifier
  // (GED99902), with the file URL and the signed authorization headers.
  /** @param {Attachment} attachment */
  async function downloadViaViewer(attachment) {
    const r = await request(`/GED/GED99902.aspx?codigo=${encodeURIComponent(attachment.code)}`, {
      credentials: 'include',
    });
    if (!r.ok) throw new Error(`visualizador do SIGA respondeu HTTP ${r.status}`);
    const viewerPage = parseViewer(await r.text());
    if (!viewerPage) throw new Error('visualizador do SIGA sem endereço do arquivo');
    return downloadFromBlob(viewerPage.url, viewerPage.headers);
  }

  // Old path: GED99901 (download button), without authorization. Only works
  // when the file is publicly readable in storage.
  /** @param {Attachment} attachment */
  async function downloadViaDownloadPage(attachment) {
    const r = await request(`/GED/GED99901.aspx?codigo=${encodeURIComponent(attachment.code)}`, {
      credentials: 'include',
    });
    if (!r.ok) throw new Error(`download do SIGA respondeu HTTP ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (typeFromSignature(bytes)) return bytes;
    const url = downloadUrl(new TextDecoder('utf-8').decode(bytes));
    if (!url) throw new Error('download do SIGA sem endereço do arquivo');
    return downloadFromBlob(url);
  }

  /**
   * @param {Attachment} attachment
   * @returns {Promise<FileData>}
   */
  async function downloadAttachment(attachment) {
    let bytes;
    try {
      bytes = await downloadViaViewer(attachment);
    } catch (e1) {
      try {
        bytes = await downloadViaDownloadPage(attachment);
      } catch (e2) {
        throw new AttachmentUnavailableError(
          `Não consegui baixar o anexo "${attachment.name}" (${/** @type {Error} */ (e1).message}; ${/** @type {Error} */ (e2).message}).`,
          { cause: e2 },
        );
      }
    }
    const type = typeFromSignature(bytes);
    if (!type) throw new UnsupportedAttachmentError(attachment.name);
    return { name: attachment.name, type, bytes };
  }

  return { getEntries, detail, attachments, downloadAttachment };
}

/** @typedef {ReturnType<typeof createSigaClient>} SigaClient */
