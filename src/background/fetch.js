// @ts-check
// Fetches URLs on behalf of the content script (SEFAZ queries and files on
// Azure Blob), which the SIGA page cannot fetch because of CORS.
import { ALLOWED_HEADERS, ALLOWED_URLS, SEFAZ } from '../config.js';
import { bytesToBase64 } from '../infra/bytes.js';
import { blockedResponse, okResponse } from '../infra/messages.js';
import { isFirewallResponse } from './firewall.js';
import { blockMessage } from './sefaz-block.js';

/** @typedef {import('../infra/messages.js').FetchRequest} FetchRequest */
/** @typedef {import('../infra/messages.js').FetchResponse} FetchResponse */

/** @param {string} url */
export const isAllowed = (url) => ALLOWED_URLS.some((re) => re.test(url));
/** @param {string} url */
export const isSefaz = (url) => SEFAZ.URLS.some((re) => re.test(url));

/**
 * Only forwards the headers the SIGA viewer uses for Azure Blob.
 * @param {Record<string, unknown>} [headers]
 * @returns {Record<string, string>}
 */
export function filterHeaders(headers = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (ALLOWED_HEADERS.has(k.toLowerCase())) out[k] = String(v);
  }
  return out;
}

/**
 * @param {ArrayBuffer} buf
 * @param {string | null} contentType
 */
export function decodeBody(buf, contentType) {
  const m = /charset=([^;]+)/i.exec(contentType || '');
  const charset = (m ? m[1] : 'utf-8').trim().toLowerCase();
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

/**
 * @param {Object} deps
 * @param {import('./sefaz-block.js').SefazBlock} deps.block
 * @param {typeof fetch} [deps.fetch]
 */
export function createFetcher({ block, fetch: request = (...a) => globalThis.fetch(...a) }) {
  /**
   * @param {FetchRequest} req
   * @returns {Promise<FetchResponse>}
   */
  return async function fetchUrl(req) {
    const sefaz = isSefaz(req.url);
    const r = await request(req.url, {
      // On SEFAZ, keeps the firewall cookies between queries, like a browser would.
      credentials: sefaz ? 'include' : 'omit',
      cache: 'no-store',
      headers: filterHeaders(req.headers),
    });
    const buf = await r.arrayBuffer();
    if (sefaz) {
      const text = decodeBody(buf, r.headers.get('content-type'));
      if (isFirewallResponse(text)) {
        await block.mark();
        return blockedResponse(blockMessage(await block.until()));
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return okResponse(text);
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return okResponse(
      req.format === 'base64' ? bytesToBase64(new Uint8Array(buf)) : decodeBody(buf, r.headers.get('content-type')),
    );
  };
}
