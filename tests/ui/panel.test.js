// Tests the panel (ui/) and the content/init.js flow in the DOM, with SIGA and validation mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocked SIGA, validation and settings (methods are swapped in each test).
const Siga = {};
const Validation = {};

// Mounts the panel like src/entries/content.js does, with mocked dependencies.
async function importContent() {
  vi.resetModules();
  const { createPanel } = await import('../../src/ui/panel.js');
  const { initPanel } = await import('../../src/content/init.js');
  await initPanel({
    ui: createPanel(),
    siga: { getEntries: () => Siga.getEntries() },
    validate: (l, cfg) => Validation.validate(l, cfg),
    config: { load: () => Validation.loadConfig(), save: (cfg) => Validation.saveConfig(cfg) },
    workMonth: () => Siga.workMonth(),
  });
}
import { fakeChrome } from '../helpers/fakes.js';

const CRITERIA = [
  { id: 'amount', label: 'Valor' },
  { id: 'cnpj', label: 'CNPJ' },
  { id: 'payment', label: 'Pagto' },
  { id: 'date', label: 'Data' },
  { id: 'number', label: 'Nº' },
];
const DEFAULTS = { consumerCnpj: '61.526.398/0001-99', paymentMethod: 'Dinheiro' };

const entry = (n, extra = {}) => ({
  code: `COD-${n}`,
  number: String(100 + n),
  date: '01/09/2026',
  docNumber: String(500 + n),
  supplier: `FORNECEDOR ${n}`,
  amount: '10,00',
  ...extra,
});
const checksOk = () => Object.fromEntries(CRITERIA.map((c) => [c.id, { ok: true, siga: 'x', invoice: 'x' }]));

let chrome;
let results; // number -> fn(l) returning the result
let calls;

function defaultResult(l) {
  return {
    entry: { ...l, documentDate: l.date },
    status: 'ok',
    message: '',
    checks: checksOk(l),
    imageUrl: 'blob:nota',
    queryUrl: 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=1',
  };
}

async function mount(entries) {
  Siga.getEntries.mockResolvedValue(entries);
  await importContent();
  await vi.waitFor(() => expect(root()).not.toBeNull());
  await vi.waitFor(() => expect(q('.cnpj').value).not.toBe(''));
}

const root = () => document.getElementById('siga-validador')?.shadowRoot ?? null;
const q = (sel) => root().querySelector(sel);
const qa = (sel) => [...root().querySelectorAll(sel)];
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const rows = () =>
  qa('tbody tr.main').map((tr) => ({
    entry: text(tr.cells[0]),
    status: text(tr.querySelector('.status')),
    supplier: text(tr.querySelector('td.supplier span')),
    docNumber: text(tr.querySelector('td.supplier small')),
  }));
const chips = () =>
  Object.fromEntries(qa('.chip').map((c) => [c.dataset.filter, Number(c.querySelector('b').textContent)]));

async function validateAll() {
  q('.validate').click();
  await vi.waitFor(() => expect(q('.validate').textContent).toBe('Validar novamente'));
}

beforeEach(() => {
  document.documentElement.querySelector('#siga-validador')?.remove();
  document.head.innerHTML = '';
  document.body.innerHTML = '<div>Mês de Trabalho 09/2026</div><table><tbody></tbody></table>';
  chrome = fakeChrome();
  calls = [];
  results = {};
  for (const k of Object.keys(Siga)) delete Siga[k];
  for (const k of Object.keys(Validation)) delete Validation[k];
  Object.assign(Siga, { getEntries: vi.fn(), workMonth: () => '09/2026' });
  Object.assign(Validation, {
    CRITERIA,
    DEFAULTS,
    loadConfig: vi.fn(async () => ({ ...DEFAULTS })),
    saveConfig: vi.fn(async () => {}),
    validate: vi.fn(async (l) => {
      calls.push(l.number);
      return (results[l.number] ?? defaultResult)(l);
    }),
  });
  vi.stubGlobal('chrome', chrome);
});

afterEach(() => {
  history.replaceState({}, '', '/TES/TES00801.aspx');
});

describe('mounting', () => {
  it('creates the floating button and fills in the saved settings', async () => {
    Validation.loadConfig.mockResolvedValue({ consumerCnpj: '11222333000181', paymentMethod: 'Pix' });
    await mount([]);
    expect(q('.fab').hidden).toBe(false);
    expect(q('.panel').hidden).toBe(true);
    expect(q('.cnpj').value).toBe('11.222.333/0001-81');
    expect(q('.method').value).toBe('Pix');
  });

  it('only activates on the expenses query page (TES00801)', async () => {
    history.replaceState({}, '', '/TES/TES00804.aspx');
    await importContent();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.getElementById('siga-validador')).toBeNull();
  });

  it('does not mount twice', async () => {
    await mount([]);
    await importContent();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelectorAll('#siga-validador')).toHaveLength(1);
  });

  it('opens the panel from the button and shows the work month', async () => {
    await mount([]);
    q('.fab').click();
    expect(q('.panel').hidden).toBe(false);
    expect(q('.fab').hidden).toBe(true);
    expect(q('.sub').textContent).toBe('Mês de trabalho 09/2026');
    q('.x').click();
    expect(q('.panel').hidden).toBe(true);
  });

  it('opens the panel when the extension icon is clicked', async () => {
    await mount([]);
    chrome._listeners.forEach((f) => f({ type: 'openPanel' }));
    expect(q('.panel').hidden).toBe(false);
  });
});

describe('validation', () => {
  it('checks every entry and shows summary, table and grid highlight', async () => {
    const list = [entry(1), entry(2), entry(3), entry(4), entry(5)];
    results['102'] = (l) => ({
      ...defaultResult(l),
      status: 'divergent',
      checks: { ...checksOk(l), amount: { ok: false, siga: '10,00', invoice: '12,00' } },
    });
    results['103'] = (l) => ({
      entry: l,
      status: 'manual',
      message: 'Recibo — sem QR Code para consultar.',
      checks: null,
      imageUrl: 'blob:r',
    });
    results['104'] = (l) => ({ entry: l, status: 'error', message: 'HTTP 500', checks: null });
    results['105'] = (l) => ({ ...defaultResult(l), warning: 'Emitente da nota diferente do fornecedor.' });
    document.querySelector('tbody').innerHTML = list
      .map(
        (l) =>
          `<tr><td>${l.date}</td><td>${l.number}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td><a class="visualizar" data-codigo="${l.code}"></a></td></tr>`,
      )
      .join('');
    await mount(list);
    await validateAll();

    expect(calls.sort()).toEqual(['101', '102', '103', '104', '105']);
    expect(Validation.validate.mock.calls[0][1]).toEqual(DEFAULTS);
    expect(Validation.saveConfig).toHaveBeenCalledWith(DEFAULTS);
    expect(chips()).toEqual({ ok: 2, divergent: 1, manual: 1, error: 1 });
    expect(rows()).toEqual([
      { entry: '101', status: 'OK', supplier: 'FORNECEDOR 1', docNumber: 'Doc. 501' },
      { entry: '102', status: 'Divergente', supplier: 'FORNECEDOR 2', docNumber: 'Doc. 502' },
      { entry: '103', status: 'Manual', supplier: 'FORNECEDOR 3', docNumber: 'Doc. 503' },
      { entry: '104', status: 'Erro', supplier: 'FORNECEDOR 4', docNumber: 'Doc. 504' },
      { entry: '105', status: 'OK', supplier: 'FORNECEDOR 5', docNumber: 'Doc. 505' },
    ]);
    const details = qa('tr.detail').map(text);
    expect(details).toEqual([
      'Valor: SIGA 10,00 · Nota 12,00',
      'Recibo — sem QR Code para consultar.',
      'HTTP 500',
      'Emitente da nota diferente do fornecedor.',
    ]);
    expect(q('.progress small').textContent).toBe('5 lançamentos conferidos');
    expect(q('.csv').disabled).toBe(false);
    const classes = [...document.querySelectorAll('table tbody tr')].map((tr) => tr.className.trim());
    expect(classes).toEqual(['sv-ok', 'sv-divergent', 'sv-manual', 'sv-error', 'sv-ok']);
  });

  it("doesn't repeat the criteria: OK rows stay collapsed and divergent rows show what doesn't match", async () => {
    results['102'] = (l) => ({
      ...defaultResult(l),
      status: 'divergent',
      checks: { ...checksOk(l), amount: { ok: false, siga: '10,00', invoice: '12,00' } },
    });
    await mount([entry(1), entry(2)]);
    await validateAll();
    const [ok, div] = qa('tbody tr.main');
    expect(ok.classList.contains('expandable')).toBe(true);
    expect(div.classList.contains('expandable')).toBe(false);
    expect(qa('tr.detail')).toHaveLength(1);
    expect(qa('thead th').map(text)).toEqual(['Lanç.', 'Data', 'Fornecedor', 'Valor', 'Status', '']);
    expect(text(q('tr.detail'))).toBe('Valor: SIGA 10,00 · Nota 12,00');
  });

  it("expands and collapses an OK row's criteria on click, keeping it open across updates", async () => {
    results['101'] = (l) => ({
      ...defaultResult(l),
      checks: { ...checksOk(l), cnpj: { ok: true, siga: '61.526.398/0001-99', invoice: 'CNPJ 61.526.398/0001-99' } },
    });
    await mount([entry(1), entry(2)]);
    await validateAll();
    const badge = () => q('tr.main button.expand');
    expect(badge().getAttribute('aria-expanded')).toBe('false');
    badge().click();
    expect(badge().getAttribute('aria-expanded')).toBe('true');
    expect(qa('tr.detail li').map(text)).toEqual([
      'Valor: x',
      'CNPJ: 61.526.398/0001-99',
      'Pagto: x',
      'Data: x',
      'Nº: x',
    ]);
    q('.only-pending').click(); // re-renders the table
    q('.only-pending').click();
    expect(qa('tr.detail')).toHaveLength(1);
    q('tr.main td').click(); // clicking the row itself also collapses it
    expect(qa('tr.detail')).toHaveLength(0);
    q('tr.main .actions a').click(); // action icons don't expand the row
    expect(qa('tr.detail')).toHaveLength(0);
  });

  it('shows the collapsed settings, with the summary updated on edit', async () => {
    await mount([]);
    expect(q('details.config').open).toBe(false);
    expect(q('.config-summary').textContent).toBe('61.526.398/0001-99 · Dinheiro');
    q('.method').value = 'Pix';
    q('.method').dispatchEvent(new Event('change'));
    expect(q('.config-summary').textContent).toBe('61.526.398/0001-99 · Pix');
  });

  it('uses the settings typed in the panel', async () => {
    await mount([entry(1)]);
    q('.cnpj').value = '11222333000181';
    q('.method').value = 'Pix';
    await validateAll();
    expect(Validation.validate.mock.calls[0][1]).toEqual({ consumerCnpj: '11.222.333/0001-81', paymentMethod: 'Pix' });
  });

  it('falls back to the defaults when the fields are empty', async () => {
    await mount([entry(1)]);
    q('.cnpj').value = '';
    q('.method').value = '  ';
    await validateAll();
    expect(Validation.validate.mock.calls[0][1]).toEqual(DEFAULTS);
  });

  it('saves the settings when a field changes', async () => {
    await mount([]);
    q('.method').value = 'Pix';
    q('.method').dispatchEvent(new Event('change'));
    expect(Validation.saveConfig).toHaveBeenCalledWith({ ...DEFAULTS, paymentMethod: 'Pix' });
  });

  it('warns when there are no entries on the page', async () => {
    await mount([]);
    await validateAll();
    expect(q('table').hidden).toBe(true);
    expect(q('.empty').textContent).toBe('Nenhum lançamento encontrado nesta tela. Confira os filtros do SIGA.');
  });

  it('shows the failure when the entry list cannot be read', async () => {
    await mount([]);
    Siga.getEntries.mockRejectedValue(new Error('DataTables indisponível'));
    q('.validate').click();
    await vi.waitFor(() =>
      expect(q('.empty').textContent).toBe('Não consegui ler a lista de lançamentos: DataTables indisponível'),
    );
    expect(q('.validate').disabled).toBe(false);
  });

  it('ignores a second click while validating', async () => {
    let release;
    Validation.validate.mockImplementation(
      (l) =>
        new Promise((r) => {
          release = () => r(defaultResult(l));
          calls.push(l.number);
        }),
    );
    await mount([entry(1)]);
    q('.validate').click();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    q('.validate').click();
    release();
    await vi.waitFor(() => expect(q('.validate').textContent).toBe('Validar novamente'));
    expect(calls).toHaveLength(1);
  });

  it('escapes content coming from SIGA', async () => {
    await mount([entry(1, { supplier: '<img src=x onerror=alert(1)>' })]);
    await validateAll();
    expect(root().querySelector('tbody img')).toBeNull();
    expect(q('td.supplier span').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('revalidate errors only', () => {
  it('re-checks only the failed entries and keeps the others', async () => {
    const list = [entry(1), entry(2), entry(3), entry(4)];
    const withError = new Set(['102', '104']);
    results['102'] = results['104'] = (l) =>
      withError.has(l.number)
        ? { entry: l, status: 'error', message: 'A SEFAZ bloqueou...', sefazBlocked: true, checks: null }
        : defaultResult(l);
    await mount(list);
    await validateAll();

    expect(q('.revalidate').hidden).toBe(false);
    expect(q('.revalidate').textContent).toBe('Revalidar só os erros (2)');
    expect(q('.alert').textContent).toMatch(/A SEFAZ bloqueou\.\.\. .*Revalidar só os erros/);
    expect(qa('tr.detail').map(text)).toEqual([
      'SEFAZ em pausa: use “Revalidar só os erros” depois.',
      'SEFAZ em pausa: use “Revalidar só os erros” depois.',
    ]);

    withError.delete('102');
    calls = [];
    q('.revalidate').click();
    await vi.waitFor(() => expect(q('.progress small').textContent).toMatch(/revalidados ·/));

    expect(calls.sort()).toEqual(['102', '104']);
    expect(Siga.getEntries).toHaveBeenCalledTimes(1); // doesn't re-read the list
    expect(chips()).toMatchObject({ ok: 3, error: 1 });
    expect(q('.revalidate').textContent).toBe('Revalidar só os erros (1)');
    expect(q('.progress small').textContent).toBe('2 erros revalidados · 4 lançamentos no total');
    expect(rows().map((l) => l.entry)).toEqual(['101', '102', '103', '104']);

    withError.clear();
    calls = [];
    q('.revalidate').click();
    await vi.waitFor(() => expect(q('.revalidate').hidden).toBe(true));
    expect(calls).toEqual(['104']);
    expect(q('.alert')).toBeNull();
    expect(q('.progress small').textContent).toBe('1 erro revalidado · 4 lançamentos no total');
  });

  it('stays hidden when there are no errors', async () => {
    await mount([entry(1)]);
    await validateAll();
    expect(q('.revalidate').hidden).toBe(true);
  });

  it('disables the buttons while revalidating', async () => {
    results['101'] = (l) => ({ entry: l, status: 'error', message: 'x', checks: null });
    await mount([entry(1)]);
    await validateAll();
    let release;
    Validation.validate.mockImplementation(
      (l) =>
        new Promise((r) => {
          release = () => r(defaultResult(l));
        }),
    );
    q('.revalidate').click();
    await vi.waitFor(() => expect(q('.revalidate').textContent).toBe('Revalidando…'));
    expect(q('.revalidate').disabled).toBe(true);
    expect(q('.validate').disabled).toBe(true);
    release();
    await vi.waitFor(() => expect(q('.revalidate').hidden).toBe(true));
    expect(q('.validate').disabled).toBe(false);
  });
});

describe('filters', () => {
  beforeEach(async () => {
    results['102'] = (l) => ({ ...defaultResult(l), status: 'divergent' });
    results['103'] = (l) => ({ entry: l, status: 'manual', message: 'm', checks: null });
    await mount([entry(1), entry(2), entry(3)]);
    await validateAll();
  });

  it('filters by chip and undoes on a second click', () => {
    root().querySelector('.chip.divergent').click();
    expect(rows().map((l) => l.entry)).toEqual(['102']);
    expect(root().querySelector('.chip.divergent').classList.contains('active')).toBe(true);
    root().querySelector('.chip.divergent').click();
    expect(rows()).toHaveLength(3);
  });

  it('"Mostrar só o que precisa de atenção" hides the OK rows', () => {
    q('.only-pending').checked = true;
    q('.only-pending').dispatchEvent(new Event('change'));
    expect(rows().map((l) => l.entry)).toEqual(['102', '103']);
  });
});

describe('invoice viewer', () => {
  it('opens the invoice image and closes with the button or Esc', async () => {
    await mount([entry(1)]);
    await validateAll();
    q('button[data-action="invoice"]').click();
    expect(q('.viewer').hidden).toBe(false);
    expect(q('.viewer img').getAttribute('src')).toBe('blob:nota');
    expect(q('.viewer-title').textContent).toBe('Lançamento 101 · FORNECEDOR 1');
    q('.viewer .viewer-bar button').click();
    expect(q('.viewer').hidden).toBe(true);
    expect(q('.viewer img').hasAttribute('src')).toBe(false);
  });

  it('shows the SEFAZ and SIGA links', async () => {
    await mount([entry(1)]);
    await validateAll();
    const links = qa('.actions a').map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')]);
    expect(links).toEqual([
      ['SEFAZ', 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=1'],
      ['SIGA', '/TES/TES00804.aspx?codigo=COD-1'],
    ]);
  });
});

describe('CSV export', () => {
  it('uses "siga" in the file name when the month was not read', async () => {
    await mount([entry(1)]);
    await validateAll();
    let download;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      download = this.download;
    });
    q('.csv').click();
    expect(download).toBe('validacao-despesas-siga.csv');
  });

  it('builds the CSV with BOM, ; separator and one row per checked entry', async () => {
    results['102'] = (l) => ({
      ...defaultResult(l),
      status: 'divergent',
      checks: {
        ...checksOk(l),
        amount: { ok: false, siga: '10,00', invoice: '12,00' },
        payment: { ok: false, siga: 'Dinheiro', invoice: 'Cartão "débito"' },
      },
    });
    await mount([entry(1), entry(2)]);
    q('.fab').click(); // the work month is read when the panel opens
    await validateAll();

    let blob;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b;
      return 'blob:csv';
    });
    let download;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      download = this.download;
    });
    q('.csv').click();

    expect(download).toBe('validacao-despesas-09-2026.csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM, so Excel opens it with accents
    const [hdr, l1, l2] = new TextDecoder().decode(bytes).split('\r\n');
    expect(hdr).toBe(
      '"Lançamento";"Data";"Nº documento";"Fornecedor";"Valor SIGA";"Valor nota";"Consumidor na nota";"Pagamento na nota";"Data da nota";"Nº da nota";"Status";"Observações"',
    );
    expect(l1).toBe('"101";"01/09/2026";"501";"FORNECEDOR 1";"10,00";"x";"x";"x";"x";"x";"OK";""');
    expect(l2).toBe(
      '"102";"01/09/2026";"502";"FORNECEDOR 2";"10,00";"12,00";"x";"Cartão ""débito""";"x";"x";"Divergente";"Valor divergente; Pagto divergente"',
    );
  });
});
