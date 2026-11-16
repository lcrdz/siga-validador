// Highlights the rows of SIGA's expenses grid according to the result.
import { STATUS_LABEL } from '../domain/result.js';
import { text } from '../infra/text.js';
import { GRID_STYLES } from './styles.js';

const CLASSES = ['sv-ok', 'sv-divergent', 'sv-manual', 'sv-error'];

export function injectGridStyle(doc = document) {
  const s = doc.createElement('style');
  s.id = 'siga-validador-grade';
  s.textContent = GRID_STYLES;
  doc.head.appendChild(s);
}

/**
 * @param {Map<string, import('../domain/types.js').Result>} results
 */
export function markGrid(results, doc = document) {
  for (const tr of doc.querySelectorAll('table tbody tr')) {
    if (!tr.querySelector('a.visualizar')) continue;
    const r = results.get(text(tr.cells[1]));
    tr.classList.remove(...CLASSES);
    if (r) {
      tr.classList.add(`sv-${r.status}`);
      tr.title = r.status === 'ok' ? 'Validador: tudo confere' : `Validador: ${STATUS_LABEL[r.status]}`;
    }
  }
}

/**
 * The grid is redrawn on paging/sorting; reapplies the highlight.
 * @param {() => Map<string, import('../domain/types.js').Result>} results
 */
export function observeGrid(results, doc = document) {
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled || !results().size) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      markGrid(results(), doc);
    });
  }).observe(doc.body, { childList: true, subtree: true });
}
