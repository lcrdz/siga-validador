// Side panel (in Shadow DOM, so it does not clash with SIGA's CSS):
// rendering and events. State and transitions live in state.js.
import { formatCnpj } from '../domain/formats.js';
import { DEFAULT_CONFIG, CRITERIA } from '../domain/rules.js';
import { STATUS_LABEL } from '../domain/result.js';
import { buildCsv, csvFileName } from '../domain/csv.js';
import { esc } from '../infra/text.js';
import { STYLES } from './styles.js';
import { ICONS } from './icons.js';
import * as stateFns from './state.js';
import { injectGridStyle, markGrid, observeGrid } from './siga-grid.js';

const CHIPS = [
  ['ok', 'Conferidos'],
  ['divergent', 'Divergências'],
  ['manual', 'Conferir manualmente'],
  ['error', 'Erros'],
];

function markup() {
  return `
    <style>${STYLES}</style>
    <div class="root">
      <button class="fab" type="button">${ICONS.check}<span>Validar despesas</span></button>
      <aside class="panel" hidden aria-label="Validador de despesas">
        <header>
          <h1>Validador de despesas</h1>
          <p class="sub"></p>
          <button class="x" type="button" title="Fechar" aria-label="Fechar">×</button>
        </header>
        <section class="top-actions">
          <button class="primary validate" type="button">Validar lançamentos</button>
          <button class="secondary revalidate" type="button" hidden title="Confere de novo só os lançamentos que deram erro, mantendo os demais resultados">Revalidar só os erros</button>
          <details class="config">
            <summary title="Configurações da conferência">${ICONS.config}<span class="config-summary"></span></summary>
            <div class="fields">
              <label>CNPJ do consumidor esperado <input class="cnpj" inputmode="numeric"></label>
              <label>Forma de pagamento esperada <input class="method"></label>
            </div>
          </details>
        </section>
        <div class="progress" hidden><div class="bar"><span></span></div><small></small></div>
        <div class="summary" hidden></div>
        <div class="table-wrap">
          <table hidden>
            <thead><tr>
              <th>Lanç.</th><th>Data</th><th>Fornecedor</th><th class="n">Valor</th><th>Status</th><th></th>
            </tr></thead>
            <tbody></tbody>
          </table>
          <p class="empty">Clique em <b>Validar lançamentos</b> para conferir todas as despesas carregadas nesta tela com as notas anexadas.</p>
        </div>
        <footer>
          <label><input type="checkbox" class="only-pending"> Mostrar só o que precisa de atenção</label>
          <button class="secondary csv" type="button" disabled>Exportar CSV</button>
        </footer>
      </aside>
      <div class="viewer" hidden role="dialog" aria-label="Nota anexada">
        <div class="viewer-bar"><span class="viewer-title"></span><button type="button" aria-label="Fechar">×</button></div>
        <div class="area"><img alt="Nota anexada"></div>
      </div>
    </div>`;
}

/** Strips the repeated label from the value ("CNPJ 61.526…" → "61.526…"). */
const stripLabel = (amount, label) => String(amount).replace(new RegExp(`^${label}\\s*:?\\s*`, 'i'), '');

function renderDetailRow(r, expanded) {
  const items = [];
  // Expanded OK row: lists the matched criteria with each value.
  if (expanded && r.checks) {
    for (const c of CRITERIA) {
      const k = r.checks[c.id];
      items.push(
        `<li class="passed">${ICONS.check}<b>${c.label}:</b> ${esc(stripLabel(k.invoice || k.siga || '—', c.label))}</li>`,
      );
    }
  } else if (r.checks) {
    for (const c of CRITERIA) {
      const k = r.checks[c.id];
      if (!k.ok)
        items.push(`<li class="mismatch"><b>${c.label}:</b> SIGA ${esc(k.siga || '—')} · Nota ${esc(k.invoice)}</li>`);
    }
  }
  // The full block notice is already at the top; the row only needs a reminder.
  if (r.sefazBlocked) items.push('<li>SEFAZ em pausa: use “Revalidar só os erros” depois.</li>');
  else if (r.message) items.push(`<li>${esc(r.message)}</li>`);
  if (r.warning) items.push(`<li class="warning">${esc(r.warning)}</li>`);
  return items.length ? `<tr class="detail"><td colspan="6"><ul>${items.join('')}</ul></td></tr>` : '';
}

/**
 * Creates the panel. The API is used by content/init.js.
 * @param {Document} [doc]
 */
export function createPanel(doc = document) {
  const state = stateFns.createState();
  let root, el;
  /** OK entries with the criteria expanded (survives re-renders). */
  const expandedRows = new Set();
  let onValidate, onRevalidateErrors, onSaveConfig, readWorkMonth;

  function mount({ validate, revalidateErrors, saveConfig, workMonth = () => '' }) {
    onValidate = validate;
    onRevalidateErrors = revalidateErrors;
    onSaveConfig = saveConfig;
    readWorkMonth = workMonth;

    const host = doc.createElement('div');
    host.id = 'siga-validador';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = markup();
    doc.documentElement.appendChild(host);

    const q = (s) => root.querySelector(s);
    el = {
      fab: q('.fab'),
      panel: q('.panel'),
      sub: q('.sub'),
      close: q('.x'),
      cnpj: q('.cnpj'),
      configSummary: q('.config-summary'),
      method: q('.method'),
      validate: q('.validate'),
      revalidate: q('.revalidate'),
      progress: q('.progress'),
      bar: q('.bar span'),
      progressText: q('.progress small'),
      summary: q('.summary'),
      table: q('table'),
      body: q('tbody'),
      empty: q('.empty'),
      onlyPending: q('.only-pending'),
      csv: q('.csv'),
      viewer: q('.viewer'),
      viewerImg: q('.viewer img'),
      viewerTitle: q('.viewer-title'),
      viewerClose: q('.viewer button'),
    };

    el.fab.addEventListener('click', open);
    el.close.addEventListener('click', close);
    el.validate.addEventListener('click', () => onValidate());
    el.revalidate.addEventListener('click', () => onRevalidateErrors());
    el.onlyPending.addEventListener('change', () => {
      state.onlyPending = el.onlyPending.checked;
      renderTable();
    });
    el.csv.addEventListener('click', exportCsv);
    for (const field of [el.cnpj, el.method]) {
      field.addEventListener('change', () => {
        onSaveConfig(readConfig());
        summarizeConfig();
      });
    }
    el.viewerClose.addEventListener('click', closeViewer);
    el.viewer.addEventListener('click', (e) => {
      if (e.target === el.viewer || e.target.classList.contains('area')) closeViewer();
    });
    el.viewerImg.addEventListener('click', () => el.viewerImg.classList.toggle('zoom'));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') el.viewer.hidden ? close() : closeViewer();
    });
    el.body.addEventListener('click', onTableClick);
    el.summary.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      stateFns.toggleFilter(state, chip.dataset.filter);
      renderSummary();
      renderTable();
    });

    injectGridStyle(doc);
    observeGrid(() => state.results, doc);
  }

  function open() {
    state.month = readWorkMonth();
    el.sub.textContent = state.month ? `Mês de trabalho ${state.month}` : 'Despesas carregadas nesta tela';
    el.panel.hidden = false;
    el.fab.hidden = true;
  }

  function close() {
    el.panel.hidden = true;
    el.fab.hidden = false;
  }

  function setConfig(cfg) {
    el.cnpj.value = formatCnpj(cfg.consumerCnpj);
    el.method.value = cfg.paymentMethod;
    summarizeConfig();
  }

  // Collapsed settings: shows only the summary ("61.526.398/0001-99 · Dinheiro").
  function summarizeConfig() {
    const cfg = readConfig();
    el.configSummary.textContent = `${cfg.consumerCnpj} · ${cfg.paymentMethod}`;
  }

  function readConfig() {
    return {
      consumerCnpj: formatCnpj(el.cnpj.value.trim()) || DEFAULT_CONFIG.consumerCnpj,
      paymentMethod: el.method.value.trim() || DEFAULT_CONFIG.paymentMethod,
    };
  }

  const releaseImages = (results) => {
    for (const r of results) if (r.imageUrl) URL.revokeObjectURL(r.imageUrl);
  };

  function onBatchStart(partial) {
    el.validate.disabled = true;
    el.validate.textContent = partial ? 'Validar novamente' : 'Validando…';
    el.revalidate.disabled = true;
    if (partial) el.revalidate.textContent = 'Revalidando…';
    el.csv.disabled = true;
    el.progress.hidden = false;
    el.summary.hidden = false;
    renderAll();
  }

  function start(entries) {
    releaseImages(stateFns.start(state, entries));
    el.table.hidden = !entries.length;
    el.empty.hidden = !!entries.length;
    if (!entries.length) el.empty.textContent = 'Nenhum lançamento encontrado nesta tela. Confira os filtros do SIGA.';
    onBatchStart(false);
  }

  function startPartial(entryList) {
    releaseImages(stateFns.startPartial(state, entryList));
    onBatchStart(true);
  }

  function record(result) {
    stateFns.record(state, result);
    renderAll();
  }

  function updateErrorsButton() {
    const n = stateFns.entriesWithError(state).length;
    el.revalidate.hidden = n === 0;
    el.revalidate.disabled = state.running;
    el.revalidate.textContent = `Revalidar só os erros (${n})`;
  }

  function finish() {
    stateFns.finish(state);
    el.validate.disabled = false;
    el.validate.textContent = 'Validar novamente';
    el.csv.disabled = !state.results.size;
    renderProgress();
    updateErrorsButton();
  }

  function reportFailure(msg) {
    stateFns.fail(state);
    el.validate.disabled = false;
    el.validate.textContent = 'Validar lançamentos';
    el.revalidate.hidden = true;
    el.progress.hidden = true;
    el.table.hidden = true;
    el.empty.hidden = false;
    el.empty.textContent = msg;
  }

  function renderAll() {
    renderProgress();
    renderSummary();
    renderTable();
    markGrid(state.results, doc);
  }

  function renderProgress() {
    const { fraction, text } = stateFns.progress(state);
    el.bar.style.width = state.batchSize ? `${fraction * 100}%` : '0';
    el.progressText.textContent = text;
  }

  function renderSummary() {
    const c = stateFns.counts(state);
    const block = stateFns.sefazBlock(state);
    el.summary.innerHTML =
      CHIPS.filter(([s]) => s !== 'error' || c.error)
        .map(
          ([s, r]) =>
            `<button type="button" class="chip ${s} ${state.filter === s ? 'active' : ''}" data-filter="${s}"><b>${c[s]}</b> ${r}</button>`,
        )
        .join('') +
      (block
        ? `<p class="alert">${esc(block.message)} Os lançamentos já conferidos ficam guardados: depois é só clicar em “Revalidar só os erros”.</p>`
        : '');
  }

  function renderTable() {
    el.body.innerHTML = stateFns
      .visible(state)
      .map((l) => {
        const r = state.results.get(l.number);
        const status = stateFns.statusOf(state, l);
        const expandable = status === 'ok' && !!r?.checks;
        const expanded = expandable && expandedRows.has(l.number);
        const detailHtml = r ? renderDetailRow(r, expanded) : '';
        const badge = expandable
          ? `<button type="button" class="status ok expand" data-action="expand" data-entry="${esc(l.number)}" aria-expanded="${expanded}" title="${expanded ? 'Ocultar' : 'Ver'} os critérios conferidos">${STATUS_LABEL[status]}${ICONS.chevron}</button>`
          : `<span class="status ${status}">${STATUS_LABEL[status]}</span>`;
        const actions = [
          r?.imageUrl
            ? `<button type="button" data-action="invoice" data-entry="${esc(l.number)}" title="Ver a nota anexada" aria-label="Nota">${ICONS.invoice}</button>`
            : '',
          r?.queryUrl
            ? `<a href="${esc(r.queryUrl)}" target="_blank" rel="noopener" title="Abrir a consulta na SEFAZ" aria-label="SEFAZ">${ICONS.external}</a>`
            : '',
          l.code
            ? `<a href="/TES/TES00804.aspx?codigo=${encodeURIComponent(l.code)}" target="_blank" rel="noopener" title="Abrir o lançamento no SIGA" aria-label="SIGA">${ICONS.siga}</a>`
            : '',
        ].join('');
        const docNumber = r?.entry.docNumber || l.docNumber;
        return `
        <tr class="main ${detailHtml ? 'has-detail' : ''}${expandable ? ' expandable' : ''}${expanded ? ' expanded' : ''}"${expandable ? ` data-entry="${esc(l.number)}"` : ''}>
          <td>${esc(l.number)}</td>
          <td>${esc(r?.entry.documentDate || l.date)}</td>
          <td class="supplier"><span title="${esc(l.supplier)}">${esc(l.supplier)}</span>${docNumber ? `<small>Doc. ${esc(docNumber)}</small>` : ''}</td>
          <td class="n">${esc(r?.entry.amount || l.amount)}</td>
          <td>${badge}</td>
          <td><div class="actions">${actions}</div></td>
        </tr>${detailHtml}`;
      })
      .join('');
  }

  function onTableClick(e) {
    // Clicking an OK row (outside the action icons) toggles the criteria.
    const row = e.target.closest('tr.expandable');
    if (row && !e.target.closest('.actions')) {
      const n = row.dataset.entry;
      if (expandedRows.has(n)) expandedRows.delete(n);
      else expandedRows.add(n);
      renderTable();
      return;
    }
    const b = e.target.closest('button[data-action="invoice"]');
    if (!b) return;
    const r = state.results.get(b.dataset.entry);
    if (!r?.imageUrl) return;
    el.viewerImg.classList.remove('zoom');
    el.viewerImg.src = r.imageUrl;
    el.viewerTitle.textContent = `Lançamento ${r.entry.number} · ${r.entry.supplier || ''}`;
    el.viewer.hidden = false;
    el.viewerClose.focus();
  }

  function closeViewer() {
    el.viewer.hidden = true;
    el.viewerImg.removeAttribute('src');
  }

  function exportCsv() {
    const csv = buildCsv(state.entries, state.results);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = csvFileName(state.month);
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return {
    mount,
    open,
    setConfig,
    readConfig,
    start,
    startPartial,
    entriesWithError: () => stateFns.entriesWithError(state),
    record,
    finish,
    reportFailure,
    isRunning: () => state.running,
  };
}

/** @typedef {ReturnType<typeof createPanel>} Panel */
