import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSummaryPage, spProvider } from '../../src/infra/sefaz/sp.js';
import { createSefazClient } from '../../src/infra/sefaz/client.js';
import { createSefazCache } from '../../src/infra/storage/sefaz-cache.js';
import { parseQr } from '../../src/domain/nfce-qrcode.js';
import { fixture } from '../helpers/files.js';
import { InvalidQrCodeError, SefazNoDataError } from '../../src/domain/errors.js';
import { fakeChrome } from '../helpers/fakes.js';

const KEY = '35260934346686000199650030001474811104560291';
const URL_QR = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|ABC`;
const QR = parseQr(URL_QR);
const QR_WITHOUT_KEY = { ...QR, accessKey: '' };

describe('parseSummaryPage (SEFAZ-SP)', () => {
  it('reads every field of the Consulta Resumida NFC-e page', () => {
    expect(parseSummaryPage(fixture('sefaz/nfce-ok.html'))).toEqual({
      issuer: 'MERCADO EXEMPLO VILA TESTE LTDA',
      issuerCnpj: '34346686000199',
      amount: '26,36',
      payments: [{ method: 'Dinheiro', amount: '26,36' }],
      number: '147481',
      series: '3',
      issueDate: '04/09/2026',
      consumerType: 'CNPJ',
      consumer: '61.526.398/0001-99',
      accessKey: KEY,
    });
  });

  it('accepts an already loaded Document', () => {
    const doc = new DOMParser().parseFromString(fixture('sefaz/nfce-ok.html'), 'text/html');
    expect(parseSummaryPage(doc).amount).toBe('26,36');
  });

  it('reads several payment methods and ignores the change row', () => {
    const invoice = parseSummaryPage(fixture('sefaz/nfce-mixed-payment.html'));
    expect(invoice.payments).toEqual([
      { method: 'Dinheiro', amount: '10,00' },
      { method: 'Cartão de Débito', amount: '16,36' },
    ]);
  });

  it('identifies a CPF consumer', () => {
    const invoice = parseSummaryPage(fixture('sefaz/nfce-mixed-payment.html'));
    expect(invoice.consumerType).toBe('CPF');
    expect(invoice.consumer).toBe('123.456.789-09');
  });

  it('fails with the notice text when the QR Code is invalid (contingency)', () => {
    expect(() => parseSummaryPage(fixture('sefaz/invalid-qrcode.html'))).toThrow(
      /A SEFAZ não devolveu os dados da nota: Problemas na consulta via QR Code QR Code inválido.*Digest Value/,
    );
  });

  it('uses typed errors: invalid QR Code and SEFAZ without data', () => {
    expect(() => parseSummaryPage(fixture('sefaz/invalid-qrcode.html'))).toThrow(InvalidQrCodeError);
    const error = (() => {
      try {
        parseSummaryPage(fixture('sefaz/blocked.html'));
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(SefazNoDataError);
    expect(error).not.toBeInstanceOf(InvalidQrCodeError);
  });

  it('fails with the start of the page text when there are no notices (e.g. firewall)', () => {
    expect(() => parseSummaryPage(fixture('sefaz/blocked.html'))).toThrow(/The requested URL was rejected/);
  });
});

describe('SEFAZ client (cached by access key)', () => {
  let chrome;
  let client;
  beforeEach(() => {
    chrome = fakeChrome({ respond: () => ({ ok: true, payload: fixture('sefaz/nfce-ok.html') }) });
    client = createSefazClient();
    vi.stubGlobal('chrome', chrome);
  });

  it('queries through the extension and caches the result', async () => {
    const invoice = await client.query(QR);
    expect(invoice.amount).toBe('26,36');
    expect(invoice.fromCache).toBeUndefined();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage.mock.calls[0][0]).toMatchObject({ type: 'fetch', url: URL_QR, format: 'text' });
    expect(chrome._local.get(`sefaz:${KEY}`)).toMatchObject({ invoice: { amount: '26,36' } });
  });

  it('uses the cache on the second query of the same key', async () => {
    await client.query(QR);
    const invoice = await client.query(QR);
    expect(invoice.fromCache).toBe(true);
    expect(invoice.amount).toBe('26,36');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('queries again when the cache is older than 60 days', async () => {
    chrome._local.set(`sefaz:${KEY}`, { savedAt: Date.now() - 61 * 24 * 60 * 60 * 1000, invoice: { amount: '1,00' } });
    const invoice = await client.query(QR);
    expect(invoice.amount).toBe('26,36');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not use the cache when no key is given', async () => {
    await client.query(QR_WITHOUT_KEY);
    await client.query(QR_WITHOUT_KEY);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(chrome._local.size).toBe(0);
  });

  it('does not cache when the query fails', async () => {
    chrome.runtime.sendMessage.mockImplementation((msg, cb) =>
      cb({ ok: true, payload: fixture('sefaz/invalid-qrcode.html') }),
    );
    await expect(client.query(QR)).rejects.toThrow('QR Code inválido');
    expect(chrome._local.size).toBe(0);
  });

  it('passes on the service worker block error', async () => {
    chrome.runtime.sendMessage.mockImplementation((msg, cb) =>
      cb({ ok: false, blocked: true, error: 'bloqueada até 15:00' }),
    );
    const error = await client.query(QR).catch((e) => e);
    expect(error.blocked).toBe(true);
    expect(error.message).toBe('bloqueada até 15:00');
  });

  it('keeps working without storage', async () => {
    chrome.storage.local.get.mockRejectedValue(new Error('sem storage'));
    chrome.storage.local.set.mockRejectedValue(new Error('sem storage'));
    await expect(client.query(QR)).resolves.toMatchObject({ amount: '26,36' });
  });
});

describe('cache saved by earlier versions (Portuguese fields)', () => {
  it('converts the old invoice and honors the TTL', async () => {
    const area = {
      get: vi.fn(async (k) => ({
        [k]: {
          em: 1_000,
          nota: {
            emitente: 'MERCADO X',
            emitenteCnpj: '34346686000199',
            valor: '26,36',
            pagamentos: [{ forma: 'Dinheiro', valor: '26,36' }],
            numero: '147481',
            serie: '3',
            emissao: '04/09/2026',
            consumidorTipo: 'CNPJ',
            consumidor: '61.526.398/0001-99',
            chave: KEY,
          },
        },
      })),
    };
    const cache = createSefazCache({ area: () => area, now: () => 2_000, ttlMs: 10_000 });
    expect(await cache.read(KEY)).toEqual({
      issuer: 'MERCADO X',
      issuerCnpj: '34346686000199',
      amount: '26,36',
      payments: [{ method: 'Dinheiro', amount: '26,36' }],
      number: '147481',
      series: '3',
      issueDate: '04/09/2026',
      consumerType: 'CNPJ',
      consumer: '61.526.398/0001-99',
      accessKey: KEY,
    });
    const vencido = createSefazCache({ area: () => area, now: () => 20_000, ttlMs: 10_000 });
    expect(await vencido.read(KEY)).toBeNull();
  });
});

describe('clearCache', () => {
  it('removes only the SEFAZ entries', async () => {
    const chrome = fakeChrome();
    chrome._local.set('sefaz:1', {});
    chrome._local.set('sefaz:2', {});
    chrome._local.set('cnpjConsumidor', '61.526.398/0001-99');
    vi.stubGlobal('chrome', chrome);
    await createSefazClient().clearCache();
    expect([...chrome._local.keys()]).toEqual(['cnpjConsumidor']);
  });
});

describe('providers', () => {
  it('only SEFAZ-SP is supported for now', () => {
    const client = createSefazClient({ request: vi.fn(), cache: createSefazCache() });
    expect(spProvider.host).toBe('www.nfce.fazenda.sp.gov.br');
    expect(client.supports(QR)).toBe(true);
    expect(client.supports(parseQr(URL_QR.replace('www.nfce.fazenda.sp.gov.br', 'www.sefaz.rs.gov.br/NFCE')))).toBe(
      false,
    );
    expect(client.supports({ valid: false })).toBe(false);
  });

  it('uses the provider for the QR Code host', async () => {
    const another = { name: 'Teste', host: 'sefaz.teste', read: vi.fn(() => ({ amount: '1,00' })) };
    const request = vi.fn(async () => '<html>');
    const cache = { read: vi.fn(async () => null), write: vi.fn(), clear: vi.fn() };
    const client = createSefazClient({ request, cache, providers: [spProvider, another] });
    const qr = { valid: true, host: 'sefaz.teste', url: 'https://sefaz.teste/q', accessKey: KEY };
    expect(await client.query(qr)).toEqual({ amount: '1,00' });
    expect(another.read).toHaveBeenCalledWith('<html>');
    expect(request).toHaveBeenCalledWith('https://sefaz.teste/q', 'text');
    expect(cache.write).toHaveBeenCalledWith(KEY, { amount: '1,00' });
  });

  it('refuses to query an unsupported SEFAZ', async () => {
    const client = createSefazClient({ request: vi.fn(), cache: createSefazCache() });
    await expect(client.query({ valid: true, host: 'x', url: 'https://x' })).rejects.toThrow('SEFAZ não suportada: x');
  });
});
