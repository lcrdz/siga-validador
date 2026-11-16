// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { isFirewallResponse } from '../../src/background/firewall.js';
import { createSefazQueue } from '../../src/background/sefaz-queue.js';
import { createSefazBlock, blockMessage } from '../../src/background/sefaz-block.js';
import { decodeBody, isAllowed, isSefaz, filterHeaders } from '../../src/background/fetch.js';
import { fixture } from '../helpers/files.js';
import { fakeChrome } from '../helpers/fakes.js';

describe('firewall', () => {
  it('recognizes the block page and the JavaScript challenge', () => {
    expect(isFirewallResponse(fixture('sefaz/blocked.html'))).toBe(true);
    expect(isFirewallResponse(fixture('sefaz/js-challenge.html'))).toBe(true);
  });
  it('does not mistake the query page (data or notice) for it', () => {
    expect(isFirewallResponse(fixture('sefaz/nfce-ok.html'))).toBe(false);
    expect(isFirewallResponse(fixture('sefaz/invalid-qrcode.html'))).toBe(false);
  });
});

describe('SEFAZ queue', () => {
  it('runs one task at a time, with the minimum interval between them', async () => {
    let t = 1_000_000; // real clock: long after the initial "last" query (0)
    const delays = [];
    const queue = createSefazQueue({
      intervalMs: 1000,
      jitterMs: 500,
      now: () => t,
      random: () => 0.5,
      waitFor: async (ms) => {
        delays.push(ms);
        t += ms;
      },
    });
    const order = [];
    await Promise.all([1, 2, 3].map((n) => queue.run(async () => order.push(n))));
    expect(order).toEqual([1, 2, 3]);
    expect(delays).toEqual([1250, 1250]); // the first doesn't wait; the others wait interval + 50% of the jitter
  });

  it('does not wait when shouldWait returns false', async () => {
    const waitFor = vi.fn(async () => {});
    const queue = createSefazQueue({ now: () => 0, waitFor });
    await queue.run(async () => 'x');
    await queue.run(
      async () => 'y',
      async () => false,
    );
    expect(waitFor).toHaveBeenCalledTimes(1);
  });

  it('continues after a failing task', async () => {
    const queue = createSefazQueue({ intervalMs: 0, jitterMs: 0 });
    await expect(queue.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(queue.run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('SEFAZ block', () => {
  it('sets the pause and reports until when', async () => {
    const chrome = fakeChrome();
    let now = 1000;
    const block = createSefazBlock({ area: () => chrome.storage.session, pauseMs: 500, now: () => now });
    expect(await block.active()).toBe(false);
    await block.mark();
    expect(await block.until()).toBe(1500);
    expect(await block.active()).toBe(true);
    now = 1600;
    expect(await block.active()).toBe(false);
  });

  it('message with the resume time', () => {
    expect(blockMessage(new Date(2026, 10, 16, 13, 11).getTime())).toBe(
      'A SEFAZ bloqueou temporariamente as consultas automáticas (excesso de acessos). A extensão vai esperar até 13:11 antes de tentar de novo.',
    );
  });
});

describe('fetch rules', () => {
  it('allowed and SEFAZ URLs', () => {
    expect(isAllowed('https://www.nfce.fazenda.sp.gov.br/qrcode?p=1')).toBe(true);
    expect(isAllowed('https://sigablob.blob.core.windows.net/a/b.pdf')).toBe(true);
    expect(isAllowed('https://exemplo.com')).toBe(false);
    expect(isSefaz('https://www.nfce.fazenda.sp.gov.br/qrcode?p=1')).toBe(true);
    expect(isSefaz('https://sigablob.blob.core.windows.net/a/b.pdf')).toBe(false);
  });

  it('only forwards the Azure Blob headers', () => {
    expect(filterHeaders({ Authorization: 'a', 'x-ms-date': 'b', Cookie: 'c' })).toEqual({
      Authorization: 'a',
      'x-ms-date': 'b',
    });
    expect(filterHeaders()).toEqual({});
  });

  it('decodes with the given charset, defaulting to UTF-8', () => {
    const latin = new Uint8Array([0x63, 0x61, 0xe7, 0xe3, 0x6f]).buffer; // "cação" in latin1
    expect(decodeBody(latin, 'text/html; charset=iso-8859-1')).toBe('cação');
    expect(decodeBody(new TextEncoder().encode('ação').buffer, null)).toBe('ação');
    expect(decodeBody(new TextEncoder().encode('x').buffer, 'text/html; charset=nao-existe')).toBe('x');
  });
});
