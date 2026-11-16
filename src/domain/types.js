// @ts-check
// Data contracts shared between layers (types only, no code).

/**
 * SIGA expense entry. The first fields come from the grid
 * (Tesouraria › Despesa); the optional ones from the entry detail (TES00804).
 * @typedef {Object} Entry
 * @property {string} code        SIGA internal identifier (GUID)
 * @property {string} number        entry number
 * @property {string} date          date shown in the grid (dd/mm/yyyy)
 * @property {string} docNumber     document (invoice) number
 * @property {string} supplier
 * @property {string} [expense]
 * @property {string} amount         amount in Brazilian format ("1.234,56")
 * @property {string} [total]
 * @property {string} [documentDate]
 * @property {string} [documentType]   e.g. "NOTA FISCAL", "RECIBO"
 * @property {string} [supplierCnpj]  digits only
 * @property {string} [description]
 * @property {string} [remarks]
 * @property {string} [entryDate]
 * @property {string} [account]
 */

/**
 * @typedef {Object} Payment
 * @property {string} method   e.g. "Dinheiro", "Cartão de Débito"
 * @property {string} amount
 */

/**
 * NFC-e data read from the SEFAZ public query.
 * @typedef {Object} SefazInvoice
 * @property {string} issuer
 * @property {string} issuerCnpj    digits only
 * @property {string} amount           "Valor a pagar" (amount due)
 * @property {Payment[]} payments
 * @property {string} number
 * @property {string} series
 * @property {string} issueDate         dd/mm/aaaa
 * @property {string} consumerType  "CNPJ" | "CPF" | ""
 * @property {string} consumer      formatted document
 * @property {string} accessKey           access key (44 digits)
 * @property {boolean} [fromCache]      true when it came from the local cache
 */

/**
 * @typedef {Object} Config
 * @property {string} consumerCnpj
 * @property {string} paymentMethod
 */

/** @typedef {'amount' | 'cnpj' | 'payment' | 'date' | 'number'} CriterionId */

/**
 * @typedef {Object} Criterion
 * @property {CriterionId} id
 * @property {string} label
 */

/**
 * Result of comparing one criterion.
 * @typedef {Object} Check
 * @property {boolean} ok
 * @property {string} siga   expected value (from the entry or the settings)
 * @property {string} invoice   value found on the invoice
 */

/** @typedef {Record<CriterionId, Check>} Checks */

/** @typedef {'ok' | 'divergent' | 'manual' | 'error'} Status */

/**
 * Validation result of one entry.
 * @typedef {Object} Result
 * @property {Entry} entry
 * @property {Status} status
 * @property {string} message
 * @property {Checks | null} checks
 * @property {string | null} imageUrl    blob: URL of the invoice image, for the viewer
 * @property {string | null} queryUrl  SEFAZ query link
 * @property {SefazInvoice} [invoice]
 * @property {string} [warning]
 * @property {boolean} [sefazBlocked]
 */

/**
 * Data extracted from an NF-e/NFC-e access key.
 * @typedef {Object} AccessKey
 * @property {string} accessKey         44 digits
 * @property {string} uf            IBGE state code (e.g. "35" = SP)
 * @property {string} yearMonth        issue YYMM
 * @property {string} issuerCnpj  14 digits
 * @property {string} model        "55" NF-e, "65" NFC-e
 * @property {string} series         without leading zeros
 * @property {string} number        without leading zeros
 * @property {string} emissionType   "1" normal, "9" offline contingency (NFC-e)...
 * @property {string} code        numeric code (cNF)
 * @property {string} dv            check digit as given
 * @property {boolean} checkDigitValid     the check digit matches
 */

/**
 * Parsed content of an NFC-e QR Code.
 * @typedef {Object} NfceQr
 * @property {boolean} valid        has a 44-digit key
 * @property {string} [url]
 * @property {string} [host]
 * @property {string} [accessKey]
 * @property {string} [uf]
 * @property {string} [yearMonth]
 * @property {string} [issuerCnpj]
 * @property {string} [model]
 * @property {string} [series]
 * @property {string} [number]
 * @property {string} [emissionType]
 * @property {boolean} [contingency] issued in offline contingency (emission type 9)
 * @property {boolean} [checkDigitValid]
 */

export {};
