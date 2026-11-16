import { describe, it, expect } from 'vitest';
import {
  AttachmentUnavailableError,
  ValidationError,
  UnsupportedAttachmentError,
  InvalidQrCodeError,
  SefazBlockedError,
  SefazNoDataError,
  SessionExpiredError,
  classifyError,
} from '../../src/domain/errors.js';

describe('errors', () => {
  it('have a name and a user-facing message', () => {
    const e = new SessionExpiredError();
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.name).toBe('SessionExpiredError');
    expect(e.message).toBe('Não consegui ler o lançamento — a sessão do SIGA pode ter expirado. Recarregue a página.');
    expect(new UnsupportedAttachmentError('a.gif').message).toBe('Formato de anexo não suportado (a.gif)');
    expect(new SefazNoDataError().message).toBe('A SEFAZ não devolveu os dados da nota');
    expect(new SefazNoDataError('aviso X').message).toBe('A SEFAZ não devolveu os dados da nota: aviso X');
  });

  it('invalid QR Code is a case of "SEFAZ without data"', () => {
    const e = new InvalidQrCodeError('QR Code inválido');
    expect(e).toBeInstanceOf(SefazNoDataError);
    expect(e.warning).toBe('QR Code inválido');
  });

  it('block keeps the "blocked" flag', () => {
    expect(new SefazBlockedError('x').blocked).toBe(true);
  });

  it('keeps the cause', () => {
    const reason = new Error('404');
    expect(new AttachmentUnavailableError('falhou', { cause: reason }).cause).toBe(reason);
  });
});

describe('classifyError', () => {
  it('SEFAZ block becomes an error flagged as blocked', () => {
    expect(classifyError(new SefazBlockedError('pausa'))).toEqual({
      status: 'error',
      message: 'pausa',
      sefazBlocked: true,
    });
  });

  it('other errors become "error" with the message', () => {
    expect(classifyError(new SessionExpiredError())).toMatchObject({ status: 'error' });
    expect(classifyError(new Error('HTTP 500'))).toEqual({ status: 'error', message: 'HTTP 500' });
    expect(classifyError('texto solto')).toEqual({ status: 'error', message: 'texto solto' });
  });

  it('QR Code rejected by SEFAZ becomes Manual, with the key to check on the portal', () => {
    expect(
      classifyError(new InvalidQrCodeError('QR Code inválido'), {
        accessKey: '35261063865870000143651010000912049119149931',
      }),
    ).toEqual({
      status: 'manual',
      message:
        'A SEFAZ recusou o QR Code (nota emitida em contingência com dados inconsistentes). ' +
        'Confira pela chave de acesso: 3526 1063 8658 7000 0143 6510 1000 0912 0491 1914 9931.',
    });
    expect(classifyError(new InvalidQrCodeError('x')).message).toMatch(/Confira pela chave de acesso\.$/);
  });

  it('SEFAZ without data (other reasons) stays an error', () => {
    expect(classifyError(new SefazNoDataError('fora do ar'))).toMatchObject({ status: 'error' });
  });
});
