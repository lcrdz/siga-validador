import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, CRITERIA, issuerWarning, compare, allMatch } from '../../src/domain/rules.js';

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

describe('compare', () => {
  const compareWith = (entry = {}, invoice = {}, cfg = CFG) =>
    compare({ ...ENTRY, ...entry }, { ...INVOICE, ...invoice }, cfg);

  it('passes when everything matches', () => {
    const r = compareWith();
    expect(Object.values(r).every((c) => c.ok)).toBe(true);
    expect(r).toEqual({
      amount: { ok: true, siga: '26,36', invoice: '26,36' },
      cnpj: { ok: true, siga: '61.526.398/0001-99', invoice: 'CNPJ 61.526.398/0001-99' },
      payment: { ok: true, siga: 'Dinheiro', invoice: 'Dinheiro' },
      date: { ok: true, siga: '04/09/2026', invoice: '04/09/2026' },
      number: { ok: true, siga: '147481', invoice: '147481' },
    });
  });

  it('amount: compares numerically with half-cent tolerance', () => {
    expect(compareWith({ amount: '1.234,50' }, { amount: '1234,50' }).amount.ok).toBe(true);
    expect(compareWith({ amount: '26,36' }, { amount: '26,37' }).amount.ok).toBe(false);
    expect(compareWith({}, { amount: '' }).amount).toEqual({ ok: false, siga: '26,36', invoice: '—' });
  });

  it('cnpj: ignores formatting and rejects CPF or a missing value', () => {
    expect(compareWith({}, { consumer: '61526398000199' }).cnpj.ok).toBe(true);
    expect(compareWith({}, { consumerType: 'CPF', consumer: '123.456.789-09' }).cnpj.ok).toBe(false);
    expect(compareWith({}, { consumer: '', consumerType: '' }).cnpj).toEqual({
      ok: false,
      siga: '61.526.398/0001-99',
      invoice: 'não identificado',
    });
  });

  it('cnpj: uses the configured CNPJ', () => {
    expect(
      compareWith({}, { consumer: '11.222.333/0001-81' }, { ...CFG, consumerCnpj: '11222333000181' }).cnpj.ok,
    ).toBe(true);
  });

  it('payment: ignores case and accents and requires every method to match', () => {
    expect(compareWith({}, { payments: [{ method: 'DINHEIRO' }] }).payment.ok).toBe(true);
    expect(
      compareWith({}, { payments: [{ method: 'Cartão de Débito' }] }, { ...CFG, paymentMethod: 'cartao de debito' })
        .payment.ok,
    ).toBe(true);
    const mixed = compareWith({}, { payments: [{ method: 'Dinheiro' }, { method: 'Cartão de Débito' }] }).payment;
    expect(mixed).toEqual({ ok: false, siga: 'Dinheiro', invoice: 'Dinheiro + Cartão de Débito' });
    expect(compareWith({}, { payments: [] }).payment).toEqual({ ok: false, siga: 'Dinheiro', invoice: '—' });
  });

  it('date: compares the document date with the issue date', () => {
    expect(compareWith({ documentDate: '05/09/2026' }).date.ok).toBe(false);
  });

  it('number: ignores leading zeros and non-digits', () => {
    expect(compareWith({ docNumber: '000147481' }).number.ok).toBe(true);
    expect(compareWith({ docNumber: 'NF 147481' }).number.ok).toBe(true);
    expect(compareWith({ docNumber: '147482' }).number.ok).toBe(false);
  });
});

describe('criteria and default settings', () => {
  it('exposes the five criteria in table order', () => {
    expect(CRITERIA.map((c) => c.id)).toEqual(['amount', 'cnpj', 'payment', 'date', 'number']);
  });

  it('uses the Congregação CNPJ and cash payment by default', () => {
    expect(DEFAULT_CONFIG).toEqual(CFG);
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
  });
});

describe('allMatch', () => {
  it('only passes when every criterion matches', () => {
    const checks = compare(ENTRY, INVOICE, CFG);
    expect(allMatch(checks)).toBe(true);
    expect(allMatch({ ...checks, date: { ok: false, siga: 'a', invoice: 'b' } })).toBe(false);
  });
});

describe('issuerWarning', () => {
  it('warns when the issuer is not the supplier', () => {
    expect(issuerWarning('34346686000199', '11222333000181')).toBe(
      'Emitente da nota (11.222.333/0001-81) diferente do fornecedor do lançamento.',
    );
  });
  it('does not warn when they match or either is missing', () => {
    expect(issuerWarning('34346686000199', '34346686000199')).toBeUndefined();
    expect(issuerWarning('', '11222333000181')).toBeUndefined();
    expect(issuerWarning('34346686000199', undefined)).toBeUndefined();
  });
});
