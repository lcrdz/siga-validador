// @ts-check
// User settings (expected consumer CNPJ and payment method).
import { DEFAULT_CONFIG } from '../../domain/rules.js';

/** @typedef {import('../../domain/types.js').Config} Config */

/** Keys saved by versions up to 0.1.4 (identifiers were in Portuguese). */
const LEGACY_KEYS = Object.freeze({ cnpjConsumidor: null, formaPagamento: null });

/**
 * @param {Object} [deps]
 * @param {() => chrome.storage.StorageArea} [deps.area]  read on every use
 */
export function createConfigStorage({ area = () => chrome.storage.local } = {}) {
  /** @returns {Promise<Config>} */
  async function load() {
    try {
      const s = /** @type {Record<string, string | null>} */ (
        await area().get({ consumerCnpj: null, paymentMethod: null, ...LEGACY_KEYS })
      );
      return {
        consumerCnpj: s.consumerCnpj ?? s.cnpjConsumidor ?? DEFAULT_CONFIG.consumerCnpj,
        paymentMethod: s.paymentMethod ?? s.formaPagamento ?? DEFAULT_CONFIG.paymentMethod,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  /** @param {Config} cfg */
  async function save(cfg) {
    try {
      await area().set(cfg);
    } catch {
      /* no storage (e.g. test outside the extension) */
    }
  }

  return { load, save };
}

/** @typedef {ReturnType<typeof createConfigStorage>} ConfigStorage */
