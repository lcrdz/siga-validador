import { describe, it, expect } from 'vitest';
import { checkDigit, parseAccessKey } from '../../src/domain/access-key.js';

// Real keys (normal NFC-e, contingency NFC-e and NF-e model 55) seen on the Congregação invoices.
const NFCE = '35260934346686000199650030001474811104560291';
const NFCE_CONTINGENCY = '35261063865870000143651010000912049119149931';
const NFE_55 = '35261000798858000143550010000229841119149937';

describe('checkDigit', () => {
  it.each([NFCE, NFCE_CONTINGENCY, NFE_55])('confere o DV de %s', (accessKey) => {
    expect(checkDigit(accessKey.slice(0, 43))).toBe(accessKey[43]);
  });

  it('uses 0 when the remainder is 0 or 1', () => {
    // 43 zeros: sum 0, remainder 0
    expect(checkDigit('0'.repeat(43))).toBe('0');
  });
});

describe('parseAccessKey', () => {
  it('splits the fields of an NFC-e', () => {
    expect(parseAccessKey(NFCE)).toEqual({
      accessKey: NFCE,
      uf: '35',
      yearMonth: '2609',
      issuerCnpj: '34346686000199',
      model: '65',
      series: '3',
      number: '147481',
      emissionType: '1',
      code: '10456029',
      dv: '1',
      checkDigitValid: true,
    });
  });

  it('recognizes an offline contingency NFC-e (emission type 9)', () => {
    expect(parseAccessKey(NFCE_CONTINGENCY)).toMatchObject({
      model: '65',
      series: '101',
      number: '91204',
      emissionType: '9',
    });
  });

  it('recognizes NF-e model 55', () => {
    expect(parseAccessKey(NFE_55)).toMatchObject({
      model: '55',
      number: '22984',
      yearMonth: '2610',
      issuerCnpj: '00798858000143',
      checkDigitValid: true,
    });
  });

  it('accepts the key with spaces, as printed on the DANFE', () => {
    expect(parseAccessKey('3526 1000 7988 5800 0143 5500 1000 0229 8411 1914 9937')?.accessKey).toBe(NFE_55);
  });

  it('detects a wrong check digit', () => {
    expect(parseAccessKey(NFCE.slice(0, 43) + '9')?.checkDigitValid).toBe(false);
  });

  it('returns null when there are not 44 digits', () => {
    expect(parseAccessKey('123')).toBeNull();
    expect(parseAccessKey(NFCE + '1')).toBeNull();
    expect(parseAccessKey('')).toBeNull();
  });
});
