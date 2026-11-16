import { describe, it, expect } from 'vitest';
import { formatCnpj, normalizeText, brNumber, digitsOnly } from '../../src/domain/formats.js';

describe('formats', () => {
  it('digitsOnly', () => {
    expect(digitsOnly('61.526.398/0001-99')).toBe('61526398000199');
    expect(digitsOnly(undefined)).toBe('');
  });

  it('brNumber', () => {
    expect(brNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(brNumber('R$ 26,36')).toBeCloseTo(26.36);
    expect(brNumber('')).toBeNaN();
  });

  it('formatCnpj', () => {
    expect(formatCnpj('61526398000199')).toBe('61.526.398/0001-99');
    expect(formatCnpj('123')).toBe('123');
  });

  it('normalizeText removes accents, surrounding spaces and uppercase', () => {
    expect(normalizeText('  Cartão de DÉBITO ')).toBe('cartao de debito');
    expect(normalizeText(null)).toBe('');
  });
});

describe('digitsOnly – cases', () => {
  it('keeps only the digits', () => {
    expect(digitsOnly('61.526.398/0001-99')).toBe('61526398000199');
  });
  it('treats null/undefined as empty', () => {
    expect(digitsOnly(null)).toBe('');
    expect(digitsOnly(undefined)).toBe('');
  });
});

describe('brNumber – cases', () => {
  it.each([
    ['26,36', 26.36],
    ['1.234,56', 1234.56],
    ['R$ 1.547,99', 1547.99],
    ['100', 100],
    ['-3,5', -3.5],
  ])('converte %s', (input, expected) => {
    expect(brNumber(input)).toBeCloseTo(expected, 5);
  });
  it.each([null, undefined, '', '-', 'NaN'])('devolve NaN para %s', (input) => {
    expect(brNumber(input)).toBeNaN();
  });
});

describe('formatCnpj – cases', () => {
  it('formats 14 digits', () => {
    expect(formatCnpj('61526398000199')).toBe('61.526.398/0001-99');
  });
  it('accepts an already formatted value', () => {
    expect(formatCnpj('61.526.398/0001-99')).toBe('61.526.398/0001-99');
  });
  it('returns the input when it does not have 14 digits', () => {
    expect(formatCnpj('123')).toBe('123');
    expect(formatCnpj('')).toBe('');
    expect(formatCnpj(null)).toBe('');
  });
});
