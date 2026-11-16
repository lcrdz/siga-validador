import { describe, it, expect } from 'vitest';
import {
  MESSAGES,
  STATUS_LABEL,
  formatAccessKey,
  STATUS,
  newResult,
  noQrCode,
  statusFromChecks,
} from '../../src/domain/result.js';

const ok = { ok: true, siga: 'a', invoice: 'a' };
const checksOk = { amount: ok, cnpj: ok, payment: ok, date: ok, number: ok };

describe('result', () => {
  it('starts as error, without message or checks, with a copy of the entry', () => {
    const entry = { code: 'C', number: '1', date: 'd', docNumber: '2', supplier: 'F', amount: '1,00' };
    const r = newResult(entry);
    expect(r).toEqual({ entry, status: 'error', message: '', checks: null, imageUrl: null, queryUrl: null });
    expect(r.entry).not.toBe(entry);
  });

  it('statusFromChecks', () => {
    expect(statusFromChecks(checksOk)).toBe(STATUS.OK);
    expect(statusFromChecks({ ...checksOk, amount: { ok: false, siga: 'a', invoice: 'b' } })).toBe(STATUS.DIVERGENT);
  });

  it('noQrCode tells a receipt from an invoice without QR', () => {
    expect(noQrCode('RECIBO')).toEqual({ status: 'manual', message: MESSAGES.receipt });
    expect(noQrCode('NOTA FISCAL')).toEqual({ status: 'manual', message: MESSAGES.noQr });
    expect(noQrCode(undefined)).toEqual({ status: 'manual', message: MESSAGES.noQr });
  });

  it('has a label for each status and for "queued"', () => {
    for (const s of Object.values(STATUS)) expect(STATUS_LABEL[s]).toBeTruthy();
    expect(STATUS_LABEL.pending).toBe('Na fila');
  });

  it('message for an NFC-e from another state', () => {
    expect(MESSAGES.otherSefaz('www.sefaz.rs.gov.br')).toBe(
      'NFC-e de outra SEFAZ (www.sefaz.rs.gov.br). Abra a consulta para conferir.',
    );
  });

  it('formats the key in groups of 4 digits', () => {
    expect(formatAccessKey('35260934346686000199650030001474811104560291')).toBe(
      '3526 0934 3466 8600 0199 6500 3000 1474 8111 0456 0291',
    );
  });
});
