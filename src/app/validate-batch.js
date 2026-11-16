// @ts-check
// Use case: validate several entries with limited concurrency.
import { VALIDATION } from '../config.js';

/** @typedef {import('../domain/types.js').Entry} Entry */
/** @typedef {import('../domain/types.js').Config} Config */
/** @typedef {import('../domain/types.js').Result} Result */

/**
 * Runs fn on up to n items at a time.
 * @template T
 * @param {T[]} items
 * @param {number} n
 * @param {(item: T, index: number) => Promise<void>} fn
 */
export async function inBatches(items, n, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

/**
 * Validates the list and reports each result as soon as it is ready.
 * @param {Entry[]} entries
 * @param {Object} options
 * @param {(entry: Entry, cfg: Config) => Promise<Result>} options.validate
 * @param {Config} options.cfg
 * @param {(result: Result) => void} options.onValidate
 * @param {number} [options.concurrency]
 */
export async function validateBatch(entries, { validate, cfg, onValidate, concurrency = VALIDATION.CONCURRENCY }) {
  await inBatches(entries, concurrency, async (l) => {
    onValidate(await validate(l, cfg));
  });
}
