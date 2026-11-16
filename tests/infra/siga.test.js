import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSigaClient } from '../../src/infra/siga/client.js';
import { parseViewer, workMonth, typeFromSignature, downloadUrl } from '../../src/infra/siga/parsers.js';
import { fixture } from '../helpers/files.js';
import {
  AttachmentUnavailableError,
  UnsupportedAttachmentError,
  SessionExpiredError,
} from '../../src/domain/errors.js';
import { response, fakeFetch, fakeChrome, pdfWithJpegs, fakeJpeg } from '../helpers/fakes.js';

const BLOB = 'https://sigablob.blob.core.windows.net/siga-arquivos/0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0.PDF';
const ATTACHMENT = { code: 'ARQ-1', name: '01_NF_147481_04092026.pdf', size: '127,22' };
const PDF = pdfWithJpegs([fakeJpeg()]);

// Reloads the bridge (bridge.js): it registers its listener when imported.
async function loadBridge() {
  vi.resetModules();
  await import('../../src/entries/bridge.js');
}

// Grid row as SIGA's DataTables stores it (_aData): 10 columns, the last one with the menu.
function gridRow(n) {
  return [
    `0${n}/09/2026`,
    `12756${n}`,
    `14748${n}`,
    `<span>MERCADO ${n}</span>`,
    '<span>3027 - ALIMENTAÇÃO</span>',
    `2${n},36`,
    '-',
    '-',
    `2${n},36`,
    `<div class="dropdown"><ul><li><a class="visualizar" data-codigo="COD-${n}" href="#">Visualizar</a></li></ul></div>`,
  ];
}

// Client with the default dependencies (global fetch, chrome and window, mocked in tests).
const Siga = createSigaClient();

describe('SIGA client – getEntries', () => {
  beforeEach(() => {
    delete window.__sigaValidadorBridge; // allows loading the bridge again
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads every DataTables row through the bridge (bridge.js), including other pages', async () => {
    vi.stubGlobal('jQuery', {
      fn: { dataTableSettings: [{ sTableId: 'grid1', aoData: [1, 2, 3].map((n) => ({ _aData: gridRow(n) })) }] },
    });
    await loadBridge();
    const list = await Siga.getEntries();
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({
      code: 'COD-1',
      date: '01/09/2026',
      number: '127561',
      docNumber: '147481',
      supplier: 'MERCADO 1',
      expense: '3027 - ALIMENTAÇÃO',
      amount: '21,36',
      total: '21,36',
    });
  });

  it('ignores rows without a code (e.g. the total row)', async () => {
    const withoutCode = gridRow(9);
    withoutCode[9] = '';
    vi.stubGlobal('jQuery', {
      fn: { dataTableSettings: [{ sTableId: 'grid1', aoData: [{ _aData: gridRow(1) }, { _aData: withoutCode }] }] },
    });
    await loadBridge();
    expect(await Siga.getEntries()).toHaveLength(1);
  });

  it('reads the visible table rows when the page has no DataTables', async () => {
    vi.stubGlobal('jQuery', undefined);
    await loadBridge();
    document.body.innerHTML = `<table><tbody>
      <tr>${gridRow(4)
        .map((c) => `<td>${c}</td>`)
        .join('')}</tr>
      <tr><td colspan="10">Total</td></tr>
    </tbody></table>`;
    const list = await Siga.getEntries();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ code: 'COD-4', number: '127564', supplier: 'MERCADO 4' });
  });

  it("falls back to the visible table if the bridge doesn't answer within 2 s", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = `<table><tbody><tr>${gridRow(5)
        .map((c) => `<td>${c}</td>`)
        .join('')}</tr></tbody></table>`;
      const promise = Siga.getEntries(); // without bridge.js loaded
      await vi.advanceTimersByTimeAsync(2000);
      expect(await promise).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SIGA client – detail', () => {
  it('reads the entry fields (TES00804)', async () => {
    const fetch = fakeFetch([[/TES00804\.aspx\?codigo=COD%201/, response(fixture('siga/tes00804.html'))]]);
    vi.stubGlobal('fetch', fetch);
    expect(await Siga.detail('COD 1')).toEqual({
      documentDate: '04/09/2026',
      documentType: 'NOTA FISCAL',
      docNumber: '147481',
      amount: '26,36',
      supplier: 'MERCADO EXEMPLO VILA TESTE [34.346.686/0001-99]',
      supplierCnpj: '34346686000199',
      description: '023 - PGTO.NF.',
      remarks: 'LANCHE PARA IRMÃS DA LIMPEZA',
      entryDate: '04/09/2026',
      account: '1009 - CAIXA DE MANUTENÇÃO - CASA DE ORAÇÃO',
    });
    expect(fetch.mock.calls[0][1]).toEqual({ credentials: 'include' });
  });

  it('reports an expired session when the page has no form', async () => {
    vi.stubGlobal('fetch', fakeFetch([[/TES00804/, response('<html><body>Login</body></html>')]]));
    await expect(Siga.detail('X')).rejects.toThrow(/sessão do SIGA pode ter expirado/);
    await expect(Siga.detail('X')).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('reports the HTTP status when SIGA fails', async () => {
    vi.stubGlobal('fetch', fakeFetch([[/TES00804/, response('error', { status: 500 })]]));
    await expect(Siga.detail('X')).rejects.toThrow('HTTP 500');
  });
});

describe('SIGA client – attachments', () => {
  it('lists the attachments through the GED service', async () => {
    const fetch = fakeFetch([
      [
        /ArquivoWS\.asmx\/Selecionar/,
        response(
          JSON.stringify({
            d: [
              {
                __type: 'Siga.Dominio.GED.ArquivoJS',
                Codigo: 'ARQ-1',
                Nome: ATTACHMENT.name,
                TamanhoKB: '127,22',
                Tipo: false,
              },
            ],
          }),
          { type: 'application/json' },
        ),
      ],
    ]);
    vi.stubGlobal('fetch', fetch);
    expect(await Siga.attachments('COD-1')).toEqual([ATTACHMENT]);
    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ origem: 'TES.Despesa', codigoOrigem: 'COD-1' });
  });

  it('returns an empty list when there are no attachments', async () => {
    vi.stubGlobal('fetch', fakeFetch([[/Selecionar/, response('{"d":[]}')]]));
    expect(await Siga.attachments('COD-1')).toEqual([]);
  });

  it('reports the HTTP status when the service fails', async () => {
    vi.stubGlobal('fetch', fakeFetch([[/Selecionar/, response('', { status: 403 })]]));
    await expect(Siga.attachments('COD-1')).rejects.toThrow('HTTP 403');
  });
});

describe('SIGA client – downloadAttachment', () => {
  it('downloads through the viewer (GED99902) sending the signed headers to Azure Blob', async () => {
    const fetch = fakeFetch([
      [/GED99902\.aspx\?codigo=ARQ-1/, response(fixture('siga/ged99902.html'))],
      [(u) => u === BLOB, response(PDF, { type: 'application/pdf' })],
    ]);
    vi.stubGlobal('fetch', fetch);
    const file = await Siga.downloadAttachment(ATTACHMENT);
    expect(file).toEqual({ name: ATTACHMENT.name, type: 'application/pdf', bytes: PDF });
    const [, blobOptions] = fetch.mock.calls[1];
    expect(blobOptions.headers).toEqual({
      authorization: 'SharedKey sigablob:QVNTSU5BVFVSQUZJQ1RJQ0lB',
      'x-ms-date': 'Mon, 16 Nov 2026 14:00:00 GMT',
    });
    expect(blobOptions.credentials).toBe('omit');
  });

  it('uses the service worker when the direct Blob fetch fails with CORS', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/GED99902/, response(fixture('siga/ged99902.html'))],
        [(u) => u === BLOB, new TypeError('Failed to fetch')],
      ]),
    );
    const chrome = fakeChrome({ respond: () => ({ ok: true, payload: btoa(String.fromCharCode(...PDF)) }) });
    vi.stubGlobal('chrome', chrome);
    const file = await Siga.downloadAttachment(ATTACHMENT);
    expect([...file.bytes]).toEqual([...PDF]);
    expect(chrome.runtime.sendMessage.mock.calls[0][0]).toMatchObject({
      url: BLOB,
      format: 'base64',
      headers: { 'x-ms-date': 'Mon, 16 Nov 2026 14:00:00 GMT' },
    });
  });

  it('falls back to the download link (GED99901) when the viewer fails', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/GED99902/, response('error', { status: 500 })],
        [/GED99901/, response(fixture('siga/ged99901.html'))],
        [(u, o) => u === BLOB && !o.headers?.authorization, response(PDF)],
      ]),
    );
    expect((await Siga.downloadAttachment(ATTACHMENT)).type).toBe('application/pdf');
  });

  it('accepts GED99901 returning the file directly', async () => {
    const jpg = fakeJpeg();
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/GED99902/, response('<html>sem endereço</html>')],
        [/GED99901/, response(jpg)],
      ]),
    );
    expect(await Siga.downloadAttachment(ATTACHMENT)).toMatchObject({ type: 'image/jpeg' });
  });

  it('recognizes PNG', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/GED99902/, response(fixture('siga/ged99902.html'))],
        [(u) => u === BLOB, response(png)],
      ]),
    );
    expect((await Siga.downloadAttachment(ATTACHMENT)).type).toBe('image/png');
  });

  it('explains both paths when both fail (e.g. 404 on the Blob)', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/GED99902/, response(fixture('siga/ged99902.html'))],
        [/GED99901/, response(fixture('siga/ged99901.html'))],
        [(u) => u === BLOB, response('<Error><Code>ResourceNotFound</Code></Error>', { status: 404 })],
      ]),
    );
    await expect(Siga.downloadAttachment(ATTACHMENT)).rejects.toThrow(
      `Não consegui baixar o anexo "${ATTACHMENT.name}" (armazenamento respondeu HTTP 404; armazenamento respondeu HTTP 404).`,
    );
    await expect(Siga.downloadAttachment(ATTACHMENT)).rejects.toBeInstanceOf(AttachmentUnavailableError);
  });

  it('rejects formats other than PDF/JPEG/PNG', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/GED99902/, response(fixture('siga/ged99902.html'))],
        [(u) => u === BLOB, response('GIF89a...')],
      ]),
    );
    await expect(Siga.downloadAttachment(ATTACHMENT)).rejects.toThrow(
      `Formato de anexo não suportado (${ATTACHMENT.name})`,
    );
    await expect(Siga.downloadAttachment(ATTACHMENT)).rejects.toBeInstanceOf(UnsupportedAttachmentError);
  });
});

describe('workMonth', () => {
  it('reads the month from the SIGA header', () => {
    document.body.innerHTML = '<div><span>Mês de Trabalho</span>\n<span>09/2026</span></div>';
    expect(workMonth(document.body.innerText)).toBe('09/2026');
  });
  it('returns empty when not found', () => {
    document.body.innerHTML = '<p>outra tela</p>';
    expect(workMonth(document.body.innerText)).toBe('');
  });
});

describe('SIGA parsers', () => {
  it('viewer without a file URL', () => {
    expect(parseViewer('<html>nada</html>')).toBeNull();
  });
  it('download without a file URL', () => {
    expect(downloadUrl('<html>nada</html>')).toBeNull();
  });
  it('type from signature', () => {
    expect(typeFromSignature(new TextEncoder().encode('%PDF-1.4'))).toBe('application/pdf');
    expect(typeFromSignature(new TextEncoder().encode('GIF89a'))).toBeNull();
  });
});

describe('dependency injection', () => {
  it('uses the given fetch instead of the global one', async () => {
    const ownFetch = vi.fn(async () => ({ ok: true, json: async () => ({ d: [] }) }));
    const client = createSigaClient({ fetch: ownFetch });
    expect(await client.attachments('COD')).toEqual([]);
    expect(ownFetch).toHaveBeenCalledTimes(1);
  });
});
