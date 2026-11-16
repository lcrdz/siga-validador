import { describe, it, expect, vi } from 'vitest';
import {
  MESSAGE,
  fetchViaExtension,
  isFetchRequest,
  fetchRequest,
  blockedResponse,
  errorResponse,
  okResponse,
} from '../../src/infra/messages.js';
import { fakeChrome } from '../helpers/fakes.js';
import { SefazBlockedError } from '../../src/domain/errors.js';

describe('fetchViaExtension', () => {
  it('sends url, format and headers to the service worker and returns the payload', async () => {
    const chrome = fakeChrome({ respond: () => ({ ok: true, payload: 'conteúdo' }) });
    vi.stubGlobal('chrome', chrome);
    await expect(fetchViaExtension('https://x', 'base64', { a: '1' })).resolves.toBe('conteúdo');
    expect(chrome.runtime.sendMessage.mock.calls[0][0]).toEqual({
      type: 'fetch',
      url: 'https://x',
      format: 'base64',
      headers: { a: '1' },
    });
  });
  it('rejects with the error message and flags the block', async () => {
    vi.stubGlobal('chrome', fakeChrome({ respond: () => ({ ok: false, error: 'bloqueado!', blocked: true }) }));
    const error = await fetchViaExtension('https://x').catch((e) => e);
    expect(error.message).toBe('bloqueado!');
    expect(error.blocked).toBe(true);
    expect(error).toBeInstanceOf(SefazBlockedError);
  });
  it('rejects when the runtime reports lastError', async () => {
    const chrome = fakeChrome();
    chrome.runtime.sendMessage = (msg, cb) => {
      chrome.runtime.lastError = { message: 'Extension context invalidated' };
      cb(undefined);
      chrome.runtime.lastError = null;
    };
    vi.stubGlobal('chrome', chrome);
    await expect(fetchViaExtension('https://x')).rejects.toThrow('Extension context invalidated');
  });
});

describe('protocol', () => {
  it('builds and recognizes the fetch request', () => {
    const p = fetchRequest('https://x', 'base64', { a: '1' });
    expect(p).toEqual({ type: 'fetch', url: 'https://x', format: 'base64', headers: { a: '1' } });
    expect(isFetchRequest(p)).toBe(true);
    expect(isFetchRequest({ type: 'openPanel' })).toBe(false);
    expect(isFetchRequest({ type: 'fetch' })).toBe(false);
    expect(isFetchRequest(null)).toBe(false);
  });

  it('responses', () => {
    expect(okResponse('d')).toEqual({ ok: true, payload: 'd' });
    expect(errorResponse('e')).toEqual({ ok: false, error: 'e' });
    expect(blockedResponse('b')).toEqual({ ok: false, blocked: true, error: 'b' });
    expect(MESSAGE).toEqual({ FETCH: 'fetch', OPEN_PANEL: 'openPanel' });
  });
});
