// @ts-check
// SEFAZ query queue: one at a time, with a minimum interval between them.
import { SEFAZ } from '../config.js';

/**
 * @param {Object} [deps]
 * @param {number} [deps.intervalMs]
 * @param {number} [deps.jitterMs]   random jitter added to the interval
 * @param {() => number} [deps.now]
 * @param {() => number} [deps.random]
 * @param {(ms: number) => Promise<void>} [deps.waitFor]
 */
export function createSefazQueue({
  intervalMs = SEFAZ.INTERVAL_MS,
  jitterMs = SEFAZ.JITTER_MS,
  now = () => Date.now(),
  random = () => Math.random(),
  waitFor = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  /** @type {Promise<unknown>} */
  let tail = Promise.resolve();
  let last = 0;

  /**
   * Runs the task when its turn comes. If `shouldWait` returns false,
   * the task runs without waiting for the interval (e.g. to answer "paused" right away).
   * @template T
   * @param {() => Promise<T>} task
   * @param {() => Promise<boolean>} [shouldWait]
   * @returns {Promise<T>}
   */
  function run(task, shouldWait = async () => true) {
    const turn = tail.then(async () => {
      if (await shouldWait()) {
        const delay = last + intervalMs + random() * jitterMs - now();
        if (delay > 0) await waitFor(delay);
        try {
          return await task();
        } finally {
          last = now();
        }
      }
      return task();
    });
    tail = turn.catch(() => {});
    return turn;
  }

  return { run };
}
