// @ts-check
// Message protocol between the content script (SIGA page) and the service worker.
import { SefazBlockedError } from '../domain/errors.js';

export const MESSAGE = Object.freeze({
  /** content → background: fetch a URL the page cannot fetch (CORS). */
  FETCH: 'fetch',
  /** background → content: open the panel (extension icon click). */
  OPEN_PANEL: 'openPanel',
});

/** @typedef {'text' | 'base64'} FetchFormat */

/**
 * @typedef {Object} FetchRequest
 * @property {'fetch'} type
 * @property {string} url
 * @property {FetchFormat} [format]
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {{ ok: true, payload: string } | { ok: false, error: string, blocked?: boolean }} FetchResponse
 */

/**
 * @param {string} url
 * @param {FetchFormat} [format]
 * @param {Record<string, string>} [headers]
 * @returns {FetchRequest}
 */
export function fetchRequest(url, format = 'text', headers = {}) {
  return { type: MESSAGE.FETCH, url, format, headers };
}

/**
 * @param {unknown} msg
 * @returns {msg is FetchRequest}
 */
export function isFetchRequest(msg) {
  return /** @type {any} */ (msg)?.type === MESSAGE.FETCH && typeof (/** @type {any} */ (msg).url) === 'string';
}

/** @param {string} payload @returns {FetchResponse} */
export const okResponse = (payload) => ({ ok: true, payload });
/** @param {string} error @returns {FetchResponse} */
export const errorResponse = (error) => ({ ok: false, error });
/** @param {string} error @returns {FetchResponse} */
export const blockedResponse = (error) => ({ ok: false, blocked: true, error });

/**
 * Asks the service worker to fetch a URL (content script side).
 * Rejects with SefazBlockedError while SEFAZ is paused.
 * @param {string} url
 * @param {FetchFormat} [format]
 * @param {Record<string, string>} [headers]
 * @returns {Promise<string>}
 */
export function fetchViaExtension(url, format = 'text', headers = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(fetchRequest(url, format, headers), (/** @type {FetchResponse | undefined} */ r) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!r?.ok) {
        const message = (r && 'error' in r && r.error) || 'Falha na requisição';
        return reject(r && 'blocked' in r && r.blocked ? new SefazBlockedError(message) : new Error(message));
      }
      resolve(r.payload);
    });
  });
}
