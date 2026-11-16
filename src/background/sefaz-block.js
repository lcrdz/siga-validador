// @ts-check
// Pause of SEFAZ queries after the firewall blocks. Kept in
// chrome.storage.session so it survives the service worker being stopped.
import { SEFAZ } from '../config.js';

const KEY = 'sefazBloqueadaAte';

/**
 * @param {Object} [deps]
 * @param {() => chrome.storage.StorageArea} [deps.area]
 * @param {number} [deps.pauseMs]
 * @param {() => number} [deps.now]
 */
export function createSefazBlock({
  area = () => chrome.storage.session,
  pauseMs = SEFAZ.BLOCK_PAUSE_MS,
  now = () => Date.now(),
} = {}) {
  /** Until when queries are paused (0 = not paused). */
  async function until() {
    try {
      const { [KEY]: amount = 0 } = await area().get(KEY);
      return /** @type {number} */ (amount);
    } catch {
      return 0;
    }
  }

  async function active() {
    return (await until()) > now();
  }

  async function mark() {
    try {
      await area().set({ [KEY]: now() + pauseMs });
    } catch {
      /* ignore */
    }
  }

  return { until, active, mark };
}

/**
 * Message shown in the panel while the pause lasts.
 * @param {number} until  timestamp when the pause ends
 */
export function blockMessage(until) {
  const time = new Date(until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `A SEFAZ bloqueou temporariamente as consultas automáticas (excesso de acessos). A extensão vai esperar até ${time} antes de tentar de novo.`;
}

/** @typedef {ReturnType<typeof createSefazBlock>} SefazBlock */
