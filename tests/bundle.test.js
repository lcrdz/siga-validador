// End-to-end test of the bundles produced by the build (dist/bridge.js and
// dist/content.js), running on a simulated SIGA page. Checks that the
// bundling (IIFE, embedded jsQR, bridge in the page context) works
// like the real extension, without real SIGA or SEFAZ.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fixture, ROOT } from './helpers/files.js';
import { response, fakeFetch, fakeChrome, pdfWithJpegs, fakeJpeg } from './helpers/fakes.js';

const KEY = '35260934346686000199650030001474811104560291';
const QR = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|ABC`;
const BLOB = 'https://sigablob.blob.core.windows.net/siga-arquivos/0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0.PDF';

let dir;
let bundles;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siga-bundle-'));
  // esbuild doesn't run inside jsdom; the build runs in a separate Node process.
  const script = pathToFileURL(path.join(ROOT, 'scripts/build.js')).href;
  execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `await (await import(${JSON.stringify(script)})).build({ out: ${JSON.stringify(dir)} })`,
  ]);
  bundles = {
    bridge: fs.readFileSync(path.join(dir, 'bridge.js'), 'utf8'),
    content: fs.readFileSync(path.join(dir, 'content.js'), 'utf8'),
  };
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const row = (code, number, docNumber) => [
  '04/09/2026',
  number,
  docNumber,
  '<span>MERCADO EXEMPLO VILA TESTE</span>',
  '<span>3027 - ALIMENTAÇÃO</span>',
  '26,36',
  '-',
  '-',
  '26,36',
  `<ul><li><a class="visualizar" data-codigo="${code}" href="#">Visualizar</a></li></ul>`,
];

describe('extension bundles', () => {
  it('validate entries end to end on a SIGA page', async () => {
    document.body.innerHTML = '<div>Mês de Trabalho 09/2026</div><table><tbody></tbody></table>';
    vi.stubGlobal('jQuery', {
      fn: {
        dataTableSettings: [
          {
            sTableId: 'grid1',
            aoData: [{ _aData: row('COD-1', '127564', '147481') }, { _aData: row('COD-2', '127571', '147599') }],
          },
        ],
      },
    });
    vi.stubGlobal(
      'fetch',
      fakeFetch([
        [/TES00804/, response(fixture('siga/tes00804.html'))],
        [
          /Selecionar/,
          (_u, o) =>
            response(
              JSON.stringify({
                d: JSON.parse(o.body).codigoOrigem === 'COD-1' ? [{ Codigo: 'ARQ-1', Nome: 'nf.pdf' }] : [],
              }),
            ),
        ],
        [/GED99902/, response(fixture('siga/ged99902.html'))],
        [(u) => u === BLOB, response(pdfWithJpegs([fakeJpeg()]))],
      ]),
    );
    vi.stubGlobal(
      'chrome',
      fakeChrome({
        respond: (msg) =>
          msg.url === QR ? { ok: true, payload: fixture('sefaz/nfce-ok.html') } : { ok: false, error: 'x' },
      }),
    );
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 100, height: 200, close() {} })),
    );
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        async detect() {
          return [{ rawValue: QR }];
        }
      },
    );

    // Like Chrome: the bridge runs in the page context and the content script isolated.
    (0, eval)(bundles.bridge);
    (0, eval)(bundles.content);

    const root = await vi.waitFor(() => {
      const r = document.getElementById('siga-validador')?.shadowRoot;
      expect(r).toBeTruthy();
      return r;
    });
    await vi.waitFor(() => expect(root.querySelector('.cnpj').value).toBe('61.526.398/0001-99'));
    root.querySelector('.fab').click();
    root.querySelector('.validate').click();
    await vi.waitFor(() => expect(root.querySelector('.validate').textContent).toBe('Validar novamente'));

    const rows = [...root.querySelectorAll('tbody tr.main')].map((tr) => [
      tr.cells[0].textContent,
      tr.querySelector('.status').textContent,
    ]);
    expect(rows).toEqual([
      ['127564', 'OK'],
      ['127571', 'Divergente'],
    ]);
    expect(root.querySelector('tr.detail').textContent).toContain('Lançamento sem nota anexada.');
  });
});
