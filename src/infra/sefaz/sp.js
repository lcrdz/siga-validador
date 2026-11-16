// @ts-check
// SEFAZ-SP: reads the "Consulta Resumida NFC-e" page (opened by the QR Code).
import { digitsOnly } from '../../domain/formats.js';
import { InvalidQrCodeError, SefazNoDataError } from '../../domain/errors.js';
import { text } from '../text.js';

/** @typedef {import('../../domain/types.js').SefazInvoice} SefazInvoice */
/** @typedef {import('../../domain/types.js').Payment} Payment */

/**
 * @param {string | Document} html
 * @returns {SefazInvoice}
 */
export function parseSummaryPage(html) {
  const doc = typeof html === 'string' ? new DOMParser().parseFromString(html, 'text/html') : html;
  const total = doc.getElementById('totalNota');
  if (!total) {
    const warning = text(doc.getElementById('avisos')) || text(doc.body).slice(0, 160);
    throw /QR Code inv[aá]lido/i.test(warning) ? new InvalidQrCodeError(warning) : new SefazNoDataError(warning);
  }

  let amount = '';
  /** @type {Payment[]} */
  const payments = [];
  let readingPayments = false;
  for (const row of total.querySelectorAll('div')) {
    const label = text(row.querySelector('label'));
    const number = text(row.querySelector('.totalNumb'));
    if (/^Valor a pagar/i.test(label)) amount = number;
    if (row.id === 'linhaForma') {
      readingPayments = true;
      continue;
    }
    if (readingPayments) {
      const method = row.querySelector('label.tx');
      if (!method) {
        readingPayments = false;
      } else if (!/^Troco/i.test(label)) {
        payments.push({ method: text(method), amount: number });
      }
    }
  }

  const infos = text(doc.getElementById('infos'));
  const take = (/** @type {RegExp} */ re) => (re.exec(infos) || [])[1] || '';
  const consumer = /Consumidor\s*(CNPJ|CPF):\s*([\d./-]+)/i.exec(infos);

  const pageContent = text(doc.getElementById('conteudo') || doc.body);
  const issuerCnpj = digitsOnly((/CNPJ:\s*([\d./-]+)/i.exec(pageContent) || [])[1]);

  return {
    issuer: text(doc.getElementById('u20')),
    issuerCnpj,
    amount,
    payments,
    number: take(/N.mero:\s*(\d+)/i),
    series: take(/S.rie:\s*(\d+)/i),
    issueDate: take(/Emiss.o:\s*(\d{2}\/\d{2}\/\d{4})/i),
    consumerType: consumer ? consumer[1].toUpperCase() : '',
    consumer: consumer ? consumer[2] : '',
    accessKey: digitsOnly(take(/Chave de acesso:\s*([\d ]{44,60})/i)),
  };
}

/** @type {import('./client.js').SefazProvider} */
export const spProvider = Object.freeze({
  name: 'SEFAZ-SP',
  host: 'www.nfce.fazenda.sp.gov.br',
  read: parseSummaryPage,
});
