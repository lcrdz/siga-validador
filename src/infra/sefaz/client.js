// @ts-check
// NFC-e queries to SEFAZ (through the service worker), cached by access key.
import { fetchViaExtension as defaultFetchViaExtension } from '../messages.js';
import { createSefazCache } from '../storage/sefaz-cache.js';
import { spProvider } from './sp.js';

/** @typedef {import('../../domain/types.js').SefazInvoice} SefazInvoice */
/** @typedef {import('../../domain/types.js').NfceQr} NfceQr */

/**
 * A SEFAZ whose query page the extension can read.
 * @typedef {Object} SefazProvider
 * @property {string} name
 * @property {string} host
 * @property {(html: string) => SefazInvoice} read
 */

/**
 * @param {Object} [deps]
 * @param {typeof defaultFetchViaExtension} [deps.request]
 * @param {import('../storage/sefaz-cache.js').SefazCache} [deps.cache]
 * @param {ReadonlyArray<SefazProvider>} [deps.providers]
 */
export function createSefazClient({
  request = defaultFetchViaExtension,
  cache = createSefazCache(),
  providers = [spProvider],
} = {}) {
  /** @param {NfceQr} qr */
  const providerFor = (qr) => providers.find((p) => p.host === qr.host);

  /**
   * Can this NFC-e be queried automatically?
   * @param {NfceQr} qr
   */
  function supports(qr) {
    return qr.valid && Boolean(providerFor(qr));
  }

  /**
   * @param {NfceQr} qr  already parsed QR Code (with url, host and key)
   * @returns {Promise<SefazInvoice>}
   */
  async function query(qr) {
    const provider = providerFor(qr);
    if (!provider || !qr.url) throw new Error(`SEFAZ não suportada: ${qr.host}`);
    if (qr.accessKey) {
      const cached = await cache.read(qr.accessKey);
      if (cached) return { ...cached, fromCache: true };
    }
    const invoice = provider.read(await request(qr.url, 'text'));
    if (qr.accessKey && invoice.amount) await cache.write(qr.accessKey, invoice);
    return invoice;
  }

  return { supports, query, clearCache: () => cache.clear() };
}

/** @typedef {ReturnType<typeof createSefazClient>} SefazClient */
