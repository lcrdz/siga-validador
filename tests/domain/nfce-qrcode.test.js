import { describe, it, expect } from 'vitest';
import { parseQr } from '../../src/domain/nfce-qrcode.js';

const KEY = '35260934346686000199650030001474811104560291';
const QR_ONLINE = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|ABCDEF0123456789ABCDEF0123456789ABCDEF01`;
const QR_OFFLINE =
  'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35261063865870000143651010000912049119149931|2|1|22|29.86|333347656f71785663614e783157546f453339663276594a7053733d|1|6EA455CD8B3D73601F9A9FAEBE78C1DEC8B214B0';

describe('parseQr', () => {
  it('reads the access key data from an online QR (v2)', () => {
    expect(parseQr(QR_ONLINE)).toMatchObject({
      valid: true,
      host: 'www.nfce.fazenda.sp.gov.br',
      accessKey: KEY,
      uf: '35',
      yearMonth: '2609',
      issuerCnpj: '34346686000199',
      model: '65',
      series: '3',
      number: '147481',
    });
  });

  it('reads an offline contingency QR (only the key is parsed)', () => {
    const info = parseQr(QR_OFFLINE);
    expect(info).toMatchObject({
      valid: true,
      number: '91204',
      series: '101',
      yearMonth: '2610',
      issuerCnpj: '63865870000143',
    });
  });

  it('accepts the chNFe parameter', () => {
    const info = parseQr(`https://www.nfce.fazenda.sp.gov.br/consulta?chNFe=${KEY}`);
    expect(info.valid).toBe(true);
    expect(info.number).toBe('147481');
  });

  it('reports the SEFAZ host of the QR Code (the SEFAZ client decides whether to query)', () => {
    const info = parseQr(QR_ONLINE.replace('www.nfce.fazenda.sp.gov.br', 'www.sefaz.rs.gov.br/NFCE'));
    expect(info.valid).toBe(true);
    expect(info.host).toBe('www.sefaz.rs.gov.br');
  });

  it('marks as invalid when the key does not have 44 digits', () => {
    const info = parseQr('https://www.nfce.fazenda.sp.gov.br/qrcode?p=123|2|1');
    expect(info.valid).toBe(false);
  });

  it('marks as invalid when the content is not a URL', () => {
    expect(parseQr('não é url')).toEqual({ valid: false });
  });

  it('ignores surrounding spaces', () => {
    expect(parseQr(`  ${QR_ONLINE}\n`).valid).toBe(true);
  });
});

describe('parseQr – extra key data', () => {
  it('reports emission type, contingency and check digit', () => {
    expect(parseQr(QR_ONLINE)).toMatchObject({ emissionType: '1', contingency: false, checkDigitValid: true });
    expect(parseQr(QR_OFFLINE)).toMatchObject({ emissionType: '9', contingency: true, checkDigitValid: true });
  });

  it('stays valid (44 digits) even with a wrong check digit', () => {
    const wrong = QR_ONLINE.replace(KEY, KEY.slice(0, 43) + '0');
    expect(parseQr(wrong)).toMatchObject({ valid: true, checkDigitValid: false });
  });
});
