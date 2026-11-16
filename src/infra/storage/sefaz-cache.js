// @ts-check
// Cache of SEFAZ queries by access key (an authorized NFC-e never changes).
import { SEFAZ } from '../../config.js';

/** @typedef {import('../../domain/types.js').SefazInvoice} SefazInvoice */

export const CACHE_PREFIX = 'sefaz:';

/** @typedef {{ savedAt: number, invoice: SefazInvoice }} CacheItem */
/** @typedef {{ em: number, nota: Record<string, any> }} LegacyCacheItem */

/**
 * Converts an invoice cached by versions up to 0.1.4 (Portuguese field names),
 * so the 60-day cache survives the update and the SEFAZ is not queried again.
 * @param {Record<string, any>} n
 * @returns {SefazInvoice}
 */
export function fromLegacy(n) {
  return {
    issuer: n.emitente,
    issuerCnpj: n.emitenteCnpj,
    amount: n.valor,
    payments: (n.pagamentos || []).map((/** @type {Record<string, string>} */ p) => ({
      method: p.forma,
      amount: p.valor,
    })),
    number: n.numero,
    series: n.serie,
    issueDate: n.emissao,
    consumerType: n.consumidorTipo,
    consumer: n.consumidor,
    accessKey: n.chave,
  };
}

/**
 * @param {Object} [deps]
 * @param {() => chrome.storage.StorageArea} [deps.area]  read on every use
 * @param {number} [deps.ttlMs]
 * @param {() => number} [deps.now]
 */
export function createSefazCache({
  area = () => chrome.storage.local,
  ttlMs = SEFAZ.CACHE_TTL_MS,
  now = () => Date.now(),
} = {}) {
  /**
   * @param {string} accessKey
   * @returns {Promise<SefazInvoice | null>}
   */
  async function read(accessKey) {
    try {
      const k = CACHE_PREFIX + accessKey;
      const item = /** @type {CacheItem | LegacyCacheItem | undefined} */ ((await area().get(k))[k]);
      if (!item) return null;
      if ('savedAt' in item) return now() - item.savedAt < ttlMs ? item.invoice : null;
      return now() - item.em < ttlMs ? fromLegacy(item.nota) : null;
    } catch {
      /* no cache */
    }
    return null;
  }

  /**
   * @param {string} accessKey
   * @param {SefazInvoice} invoice
   */
  async function write(accessKey, invoice) {
    try {
      await area().set({ [CACHE_PREFIX + accessKey]: { savedAt: now(), invoice } });
    } catch {
      /* no cache */
    }
  }

  async function clear() {
    try {
      const everything = await area().get(null);
      await area().remove(Object.keys(everything).filter((k) => k.startsWith(CACHE_PREFIX)));
    } catch {
      /* ignore */
    }
  }

  return { read, write, clear };
}

/** @typedef {ReturnType<typeof createSefazCache>} SefazCache */
