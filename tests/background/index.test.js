// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixture } from '../helpers/files.js';
import { response, fakeFetch, fakeChrome } from '../helpers/fakes.js';

const SEFAZ = 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=123|2|1|1|X';
const BLOB = 'https://sigablob.blob.core.windows.net/siga-arquivos/A.PDF';

let chrome;
let listener;

// Re-imports the service worker (it registers the listeners and keeps the queue in the module).
async function start(fetch) {
  chrome = fakeChrome();
  vi.stubGlobal('chrome', chrome);
  vi.stubGlobal('fetch', fetch);
  vi.resetModules();
  await import('../../src/background/index.js');
  [listener] = chrome._listeners;
}

// Sends a message like the content script would and returns the response.
function send(msg) {
  return new Promise((resolve) => {
    const isAsync = listener(msg, {}, resolve);
    if (isAsync !== true) setTimeout(() => resolve('__sem_resposta__'), 0);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-16T14:00:00Z') });
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('messages', () => {
  it('ignores messages of another type', async () => {
    await start(fakeFetch([]));
    expect(listener({ type: 'outro' }, {}, vi.fn())).toBe(false);
  });

  it('rejects URLs outside the allow list', async () => {
    const fetch = fakeFetch([]);
    await start(fetch);
    const r = await send({ type: 'fetch', url: 'https://exemplo.com/x' });
    expect(r).toEqual({ ok: false, error: 'Endereço não permitido pela extensão' });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Azure Blob download', () => {
  it('returns base64 and forwards only allowed headers, without cookies', async () => {
    const fetch = fakeFetch([[/blob\.core/, response(new Uint8Array([1, 2, 255]), { type: 'application/pdf' })]]);
    await start(fetch);
    const r = await send({
      type: 'fetch',
      url: BLOB,
      format: 'base64',
      headers: {
        Authorization: 'SharedKey a:b',
        'x-ms-date': 'd',
        'x-ms-version': 'v',
        cookie: 'x',
        'X-Outro': 'y',
      },
    });
    expect(r).toEqual({ ok: true, payload: btoa('\x01\x02\xff') });
    const [, options] = fetch.mock.calls[0];
    expect(options.credentials).toBe('omit');
    expect(options.headers).toEqual({ Authorization: 'SharedKey a:b', 'x-ms-date': 'd', 'x-ms-version': 'v' });
  });

  it('reports the HTTP error status', async () => {
    await start(fakeFetch([[/blob\.core/, response('', { status: 404 })]]));
    expect(await send({ type: 'fetch', url: BLOB, format: 'base64' })).toEqual({ ok: false, error: 'HTTP 404' });
  });

  it('does not go through the SEFAZ queue', async () => {
    const fetch = fakeFetch([
      [/blob\.core/, response('x')],
      [/nfce/, response(fixture('sefaz/nfce-ok.html'))],
    ]);
    await start(fetch);
    const sefaz = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    const blob = send({ type: 'fetch', url: BLOB, format: 'text' });
    await vi.advanceTimersByTimeAsync(0);
    expect((await blob).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await sefaz).ok).toBe(true);
  });
});

describe('SEFAZ queries', () => {
  it('returns the HTML as text and keeps the firewall cookies', async () => {
    const fetch = fakeFetch([[/nfce/, response(fixture('sefaz/nfce-ok.html'))]]);
    await start(fetch);
    const promise = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    await vi.advanceTimersByTimeAsync(5000);
    const r = await promise;
    expect(r.ok).toBe(true);
    expect(r.payload).toContain('totalNota');
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
  });

  it('runs one query at a time with at least 1.5 s between them', async () => {
    const timestamps = [];
    await start(
      fakeFetch([
        [
          /nfce/,
          () => {
            timestamps.push(Date.now());
            return response(fixture('sefaz/nfce-ok.html'));
          },
        ],
      ]),
    );
    const promises = [1, 2, 3, 4].map(() => send({ type: 'fetch', url: SEFAZ, format: 'text' }));
    await vi.advanceTimersByTimeAsync(20000);
    const responses = await Promise.all(promises);
    expect(responses.every((r) => r.ok)).toBe(true);
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    expect(intervals).toHaveLength(3);
    expect(intervals.every((ms) => ms >= 1500)).toBe(true);
  });

  it('detects the firewall block, warns and stops querying for 15 minutes', async () => {
    let n = 0;
    const fetch = fakeFetch([
      [/nfce/, () => (++n === 2 ? response(fixture('sefaz/blocked.html')) : response(fixture('sefaz/nfce-ok.html')))],
    ]);
    await start(fetch);
    const promises = [1, 2, 3, 4].map(() => send({ type: 'fetch', url: SEFAZ, format: 'text' }));
    await vi.advanceTimersByTimeAsync(20000);
    const responses = await Promise.all(promises);
    expect(responses.map((r) => (r.ok ? 'ok' : r.blocked ? 'bloq' : 'error'))).toEqual(['ok', 'bloq', 'bloq', 'bloq']);
    expect(fetch).toHaveBeenCalledTimes(2); // the last two don't even query
    expect(responses[1].error).toMatch(
      /^A SEFAZ bloqueou temporariamente as consultas automáticas \(excesso de acessos\)\. A extensão vai esperar até \d{2}:\d{2}/,
    );
    // the pause lasts 15 min from the block (which happened ~1.5 s after start)
    expect(chrome._session.get('sefazBloqueadaAte')).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(chrome._session.get('sefazBloqueadaAte')).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
  });

  it('treats the firewall JavaScript challenge as a block', async () => {
    const fetch = fakeFetch([[/nfce/, response(fixture('sefaz/js-challenge.html'))]]);
    await start(fetch);
    const promises = [1, 2].map(() => send({ type: 'fetch', url: SEFAZ, format: 'text' }));
    await vi.advanceTimersByTimeAsync(10000);
    const responses = await Promise.all(promises);
    expect(responses.every((r) => r.blocked)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(chrome._session.get('sefazBloqueadaAte')).toBeGreaterThan(Date.now());
  });

  it('does not mistake the "invalid QR Code" page for a block', async () => {
    await start(fakeFetch([[/nfce/, response(fixture('sefaz/invalid-qrcode.html'))]]));
    const promise = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    await vi.advanceTimersByTimeAsync(5000);
    const r = await promise;
    expect(r.ok).toBe(true);
    expect(r.payload).toContain('Digest Value');
  });

  it('queries again after the 15-minute pause ends', async () => {
    const fetch = fakeFetch([[/nfce/, response(fixture('sefaz/nfce-ok.html'))]]);
    await start(fetch);
    chrome._session.set('sefazBloqueadaAte', Date.now() + 15 * 60 * 1000);
    const during = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    await vi.advanceTimersByTimeAsync(0);
    expect((await during).blocked).toBe(true);
    expect(fetch).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    const after = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await after).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports SEFAZ HTTP errors without blocking the queue', async () => {
    let n = 0;
    await start(
      fakeFetch([
        [/nfce/, () => (++n === 1 ? response('falha', { status: 503 }) : response(fixture('sefaz/nfce-ok.html')))],
      ]),
    );
    const a = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    const b = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(await a).toEqual({ ok: false, error: 'HTTP 503' });
    expect((await b).ok).toBe(true);
  });

  it('keeps the queue going when the network fails', async () => {
    let n = 0;
    await start(
      fakeFetch([
        [/nfce/, () => (++n === 1 ? new TypeError('Failed to fetch') : response(fixture('sefaz/nfce-ok.html')))],
      ]),
    );
    const a = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    const b = send({ type: 'fetch', url: SEFAZ, format: 'text' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(await a).toEqual({ ok: false, error: 'Failed to fetch' });
    expect((await b).ok).toBe(true);
  });
});

describe('extension icon', () => {
  it('opens the panel when the tab is on SIGA', async () => {
    await start(fakeFetch([]));
    const [onClick] = chrome.action.onClicked.addListener.mock.calls[0];
    await onClick({ id: 7 });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'openPanel' });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('opens the SIGA expenses page on other tabs', async () => {
    await start(fakeFetch([]));
    chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'));
    const [onClick] = chrome.action.onClicked.addListener.mock.calls[0];
    await onClick({ id: 7 });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://siga.congregacao.org.br/TES/TES00801.aspx?f_inicio=S',
    });
  });
});
