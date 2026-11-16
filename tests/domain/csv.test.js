import { describe, it, expect } from 'vitest';
import { CSV_HEADER, buildCsv, csvFileName } from '../../src/domain/csv.js';

const entry = (n) => ({
  code: `C${n}`,
  number: `10${n}`,
  date: '01/09/2026',
  docNumber: `50${n}`,
  supplier: `F ${n}`,
  amount: '10,00',
});
const ok = (v) => ({ ok: true, siga: v, invoice: v });

describe('buildCsv', () => {
  it('header, BOM, ; separator and only checked entries', () => {
    const results = new Map([
      [
        '101',
        {
          entry: { ...entry(1), documentDate: '02/09/2026' },
          status: 'divergent',
          message: '',
          warning: 'Emitente diferente.',
          checks: {
            amount: { ok: false, siga: '10,00', invoice: '9,00' },
            cnpj: ok('c'),
            payment: ok('Dinheiro'),
            date: ok('d'),
            number: ok('501'),
          },
          imageUrl: null,
          queryUrl: null,
        },
      ],
      [
        '103',
        {
          entry: entry(3),
          status: 'manual',
          message: 'Recibo; sem "QR"',
          checks: null,
          imageUrl: null,
          queryUrl: null,
        },
      ],
    ]);
    const csv = buildCsv([entry(1), entry(2), entry(3)], results);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = csv.slice(1).split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(CSV_HEADER.map((c) => `"${c}"`).join(';'));
    expect(rows[1]).toBe(
      '"101";"02/09/2026";"501";"F 1";"10,00";"9,00";"c";"Dinheiro";"d";"501";"Divergente";"Valor divergente; Emitente diferente."',
    );
    expect(rows[2]).toBe('"103";"01/09/2026";"503";"F 3";"10,00";"";"";"";"";"";"Manual";"Recibo; sem ""QR"""');
  });
});

describe('csvFileName', () => {
  it('uses the work month or "siga"', () => {
    expect(csvFileName('09/2026')).toBe('validacao-despesas-09-2026.csv');
    expect(csvFileName('')).toBe('validacao-despesas-siga.csv');
    expect(csvFileName()).toBe('validacao-despesas-siga.csv');
  });
});
