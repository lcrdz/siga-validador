// @ts-check
// Panel state and the transitions between validation stages.
// Pure functions over a state object: no DOM, testable in isolation.
import { STATUS } from '../domain/result.js';

/** @typedef {import('../domain/types.js').Entry} Entry */
/** @typedef {import('../domain/types.js').Result} Result */
/** @typedef {import('../domain/types.js').Status} Status */
/** @typedef {Status | 'pending'} RowStatus */

/**
 * @typedef {Object} PanelState
 * @property {Entry[]} entries
 * @property {Map<string, Result>} results  by entry number
 * @property {Status | null} filter              selected chip
 * @property {boolean} onlyPending               "only what needs attention"
 * @property {boolean} running
 * @property {string} month                         work month
 * @property {number} batchSize                        size of the running batch
 * @property {Set<string>} pendingSet              numbers still queued
 * @property {boolean} partial                    the batch is "revalidate errors only"
 */

/** @returns {PanelState} */
export function createState() {
  return {
    entries: [],
    results: new Map(),
    filter: null,
    onlyPending: false,
    running: false,
    month: '',
    batchSize: 0,
    pendingSet: new Set(),
    partial: false,
  };
}

/**
 * @param {PanelState} e
 * @param {Entry[]} entryList
 * @param {boolean} partial
 */
function startBatch(e, entryList, partial) {
  e.running = true;
  e.partial = partial;
  e.batchSize = entryList.length;
  e.pendingSet = new Set(entryList.map((l) => l.number));
}

/**
 * New validation of all entries. Returns the discarded results
 * (to release the invoice images).
 * @param {PanelState} e
 * @param {Entry[]} entries
 * @returns {Result[]}
 */
export function start(e, entries) {
  const discarded = [...e.results.values()];
  e.entries = entries;
  e.results = new Map();
  e.filter = null;
  startBatch(e, entries, false);
  return discarded;
}

/**
 * Revalidates only the given entries, keeping the other results.
 * @param {PanelState} e
 * @param {Entry[]} entryList
 * @returns {Result[]} discarded results
 */
export function startPartial(e, entryList) {
  /** @type {Result[]} */
  const discarded = [];
  for (const l of entryList) {
    const r = e.results.get(l.number);
    if (r) discarded.push(r);
    e.results.delete(l.number);
  }
  if (e.filter === STATUS.ERROR) e.filter = null;
  startBatch(e, entryList, true);
  return discarded;
}

/**
 * @param {PanelState} e
 * @param {Result} result
 */
export function record(e, result) {
  e.results.set(result.entry.number, result);
  e.pendingSet.delete(result.entry.number);
}

/** @param {PanelState} e */
export function finish(e) {
  e.running = false;
}

/** @param {PanelState} e */
export function fail(e) {
  e.running = false;
}

/**
 * Entries with an error in the last validation (SEFAZ blocked, network failure etc.).
 * @param {PanelState} e
 */
export function entriesWithError(e) {
  return e.entries.filter((l) => e.results.get(l.number)?.status === STATUS.ERROR);
}

/**
 * @param {PanelState} e
 * @returns {Record<Status, number>}
 */
export function counts(e) {
  const c = { ok: 0, divergent: 0, manual: 0, error: 0 };
  for (const r of e.results.values()) c[r.status]++;
  return c;
}

/**
 * Status of an entry in the list ("pending" while queued).
 * @param {PanelState} e
 * @param {Entry} l
 * @returns {RowStatus}
 */
export function statusOf(e, l) {
  return e.results.get(l.number)?.status || 'pending';
}

/**
 * Entries visible with the filter and the "only what needs attention" option.
 * @param {PanelState} e
 */
export function visible(e) {
  return e.entries.filter((l) => {
    const status = statusOf(e, l);
    if (e.filter && status !== e.filter) return false;
    if (e.onlyPending && (status === STATUS.OK || status === 'pending')) return false;
    return true;
  });
}

/**
 * Toggles a chip filter.
 * @param {PanelState} e
 * @param {Status} status
 */
export function toggleFilter(e, status) {
  e.filter = e.filter === status ? null : status;
}

/**
 * Progress for the bar: completed fraction and text.
 * @param {PanelState} e
 * @returns {{ fraction: number, text: string }}
 */
export function progress(e) {
  const total = e.batchSize;
  const done = total - e.pendingSet.size;
  const fraction = total ? done / total : 0;
  if (e.running) {
    return { fraction, text: e.partial ? `Revalidando erros: ${done} de ${total}` : `${done} de ${total}` };
  }
  const n = e.entries.length;
  return {
    fraction,
    text: e.partial
      ? `${total} ${total === 1 ? 'erro revalidado' : 'erros revalidados'} · ${n} lançamentos no total`
      : `${n} lançamentos conferidos`,
  };
}

/**
 * First result with SEFAZ blocked (for the panel notice).
 * @param {PanelState} e
 */
export function sefazBlock(e) {
  return [...e.results.values()].find((r) => r.sefazBlocked);
}
