import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createValidator } from '../../src/app/validate-entry.js';
import { InvalidQrCodeError, SefazBlockedError } from '../../src/domain/errors.js';

// Use case dependencies, mocked and injected (methods are swapped in each test).
const Siga = {};
const Nota = {};
const Sefaz = {};
let validate;

const CFG = { consumerCnpj: '61.526.398/0001-99', paymentMethod: 'Dinheiro' };
const KEY = '35260934346686000199650030001474811104560291';

const ENTRY = {
  documentDate: '04/09/2026',
  documentType: 'NOTA FISCAL',
  docNumber: '147481',
  amount: '26,36',
  supplier: 'MERCADO [34.346.686/0001-99]',
  supplierCnpj: '34346686000199',
};
const INVOICE = {
  issuer: 'MERCADO LTDA',
  issuerCnpj: '34346686000199',
  amount: '26,36',
  payments: [{ method: 'Dinheiro', amount: '26,36' }],
  number: '147481',
  series: '3',
  issueDate: '04/09/2026',
  consumerType: 'CNPJ',
  consumer: '61.526.398/0001-99',
  accessKey: KEY,
};
const QR = {
  valid: true,
  url: `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|X`,
  host: 'www.nfce.fazenda.sp.gov.br',
  accessKey: KEY,
  issuerCnpj: '34346686000199',
  number: '147481',
};

describe('validate entry', () => {
  const base = {
    code: 'COD-1',
    number: '127564',
    date: '04/09/2026',
    docNumber: '147481',
    supplier: 'MERCADO',
    amount: '26,36',
  };

  beforeEach(() => {
    Object.assign(Siga, {
      detail: vi.fn(async () => ({ ...ENTRY })),
      attachments: vi.fn(async () => [{ code: 'ARQ-1', name: 'nf.pdf' }]),
      downloadAttachment: vi.fn(async () => ({ name: 'nf.pdf', type: 'application/pdf', bytes: new Uint8Array([1]) })),
    });
    Object.assign(Nota, {
      images: vi.fn(() => [{ bytes: new Uint8Array([0xff, 0xd8]), type: 'image/jpeg' }]),
      readQr: vi.fn(async () => QR.url),
    });
    Object.assign(Sefaz, {
      supports: vi.fn((qr) => qr.host === 'www.nfce.fazenda.sp.gov.br'),
      query: vi.fn(async () => ({ ...INVOICE })),
    });
    validate = createValidator({
      siga: Siga,
      imagesFromFile: (file) => Nota.images(file),
      readQr: (img) => Nota.readQr(img),
      sefaz: Sefaz,
    });
  });

  it('OK when the invoice matches every criterion', async () => {
    const r = await validate(base, CFG);
    expect(r.status).toBe('ok');
    expect(r.message).toBe('');
    expect(r.entry).toMatchObject({ ...base, ...ENTRY });
    expect(r.queryUrl).toBe(QR.url);
    expect(r.imageUrl).toMatch(/^blob:/);
    expect(r.invoice).toEqual(INVOICE);
    expect(Sefaz.query).toHaveBeenCalledWith(expect.objectContaining({ url: QR.url, accessKey: KEY }));
  });

  it('Divergent when a criterion does not match', async () => {
    Sefaz.query.mockResolvedValue({ ...INVOICE, amount: '30,00' });
    const r = await validate(base, CFG);
    expect(r.status).toBe('divergent');
    expect(r.checks.amount.ok).toBe(false);
  });

  it('Divergent when the entry has no attached invoice', async () => {
    Siga.attachments.mockResolvedValue([]);
    const r = await validate(base, CFG);
    expect(r.status).toBe('divergent');
    expect(r.message).toBe('Lançamento sem nota anexada.');
    expect(r.checks).toBeNull();
    expect(Siga.downloadAttachment).not.toHaveBeenCalled();
  });

  it('Manual for a receipt (no QR Code)', async () => {
    Siga.detail.mockResolvedValue({ ...ENTRY, documentType: 'RECIBO' });
    Nota.readQr.mockResolvedValue(null);
    const r = await validate(base, CFG);
    expect(r.status).toBe('manual');
    expect(r.message).toBe('Recibo — sem QR Code para consultar.');
    expect(r.imageUrl).toMatch(/^blob:/);
  });

  it('Manual when the invoice has no readable NFC-e QR (e.g. NF-e model 55)', async () => {
    Nota.readQr.mockResolvedValue(null);
    const r = await validate(base, CFG);
    expect(r.status).toBe('manual');
    expect(r.message).toMatch(/QR Code de NFC-e não encontrado/);
  });

  it('ignores non-NFC-e QR Codes and keeps looking in other images and attachments', async () => {
    Siga.attachments.mockResolvedValue([{ code: 'A' }, { code: 'B' }]);
    Nota.images.mockReturnValue([
      { bytes: new Uint8Array([1]), type: 'image/jpeg' },
      { bytes: new Uint8Array([2]), type: 'image/jpeg' },
    ]);
    Nota.readQr.mockResolvedValueOnce('https://pix.exemplo').mockResolvedValueOnce(null).mockResolvedValueOnce(QR.url);
    const r = await validate(base, CFG);
    expect(r.status).toBe('ok');
    expect(Siga.downloadAttachment).toHaveBeenCalledTimes(2);
    expect(Nota.readQr).toHaveBeenCalledTimes(3);
  });

  it('stops at the first attachment with a valid QR', async () => {
    Siga.attachments.mockResolvedValue([{ code: 'A' }, { code: 'B' }]);
    await validate(base, CFG);
    expect(Siga.downloadAttachment).toHaveBeenCalledTimes(1);
  });

  it('Manual for an NFC-e from another state, with the query link', async () => {
    Nota.readQr.mockResolvedValue(`https://www.sefaz.rs.gov.br/NFCE/qrcode?p=${KEY}|2|1|1|X`);
    const r = await validate(base, CFG);
    expect(r.status).toBe('manual');
    expect(r.message).toBe('NFC-e de outra SEFAZ (www.sefaz.rs.gov.br). Abra a consulta para conferir.');
    expect(r.queryUrl).toBe(`https://www.sefaz.rs.gov.br/NFCE/qrcode?p=${KEY}|2|1|1|X`);
    expect(Sefaz.query).not.toHaveBeenCalled();
  });

  it('Error flagged as blocked when SEFAZ is blocked', async () => {
    Sefaz.query.mockRejectedValue(new SefazBlockedError('A SEFAZ bloqueou...'));
    const r = await validate(base, CFG);
    expect(r).toMatchObject({ status: 'error', sefazBlocked: true, message: 'A SEFAZ bloqueou...' });
    expect(r.queryUrl).toBe(QR.url);
  });

  it('Error with the SEFAZ message (e.g. invalid QR Code of a contingency invoice)', async () => {
    Sefaz.query.mockRejectedValue(new Error('A SEFAZ não devolveu os dados da nota: QR Code inválido'));
    const r = await validate(base, CFG);
    expect(r.status).toBe('error');
    expect(r.sefazBlocked).toBeUndefined();
    expect(r.message).toMatch(/QR Code inválido/);
  });

  it('Manual when SEFAZ rejects the QR Code (contingency), with the key and the query link', async () => {
    Sefaz.query.mockRejectedValue(new InvalidQrCodeError('QR Code inválido. Digest Value inconsistente'));
    const r = await validate(base, CFG);
    expect(r.status).toBe('manual');
    expect(r.message).toBe(
      'A SEFAZ recusou o QR Code (nota emitida em contingência com dados inconsistentes). ' +
        'Confira pela chave de acesso: 3526 0934 3466 8600 0199 6500 3000 1474 8111 0456 0291.',
    );
    expect(r.queryUrl).toBe(QR.url);
    expect(r.checks).toBeNull();
  });

  it('Error when SIGA fails', async () => {
    Siga.detail.mockRejectedValue(new Error('sessão do SIGA pode ter expirado'));
    const r = await validate(base, CFG);
    expect(r).toMatchObject({ status: 'error', message: 'sessão do SIGA pode ter expirado', checks: null });
  });

  it('warns when the invoice issuer is not the entry supplier', async () => {
    Sefaz.query.mockResolvedValue({ ...INVOICE, issuerCnpj: '11222333000181' });
    const r = await validate(base, CFG);
    expect(r.status).toBe('ok');
    expect(r.warning).toBe('Emitente da nota (11.222.333/0001-81) diferente do fornecedor do lançamento.');
  });

  it('uses the issuer CNPJ from the key when the SEFAZ page lacks it', async () => {
    Sefaz.query.mockResolvedValue({ ...INVOICE, issuerCnpj: '' });
    // key with another issuer CNPJ (positions 7 to 20)
    const other = KEY.slice(0, 6) + '11222333000181' + KEY.slice(20);
    Nota.readQr.mockResolvedValue(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${other}|2|1|1|X`);
    const r = await validate(base, CFG);
    expect(r.warning).toMatch(/11.222.333\/0001-81/);
  });
});
