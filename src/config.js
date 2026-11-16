// @ts-check
// Extension constants: URLs, query pacing and cache lifetime.

export const SIGA = Object.freeze({
  EXPENSES_PAGE: 'https://siga.congregacao.org.br/TES/TES00801.aspx?f_inicio=S',
  /** Page where the panel is mounted (Tesouraria › Despesa › Consulta). */
  EXPENSES_ROUTE: /\/TES\/TES00801\.aspx$/i,
  /** Origin of expense attachments in SIGA's GED. */
  ATTACHMENT_ORIGIN: 'TES.Despesa',
  /** How long to wait for the bridge (bridge.js) before reading the visible table. */
  BRIDGE_TIMEOUT_MS: 2000,
});

export const VALIDATION = Object.freeze({
  /** Entries validated at the same time (SEFAZ queries still go one at a time). */
  CONCURRENCY: 4,
});

export const SEFAZ = Object.freeze({
  /** SEFAZ query URLs (go through the queue and block detection). */
  URLS: [/^https:\/\/www\.nfce\.fazenda\.sp\.gov\.br\//i],
  /** Minimum interval between queries, plus random jitter. */
  INTERVAL_MS: 1500,
  JITTER_MS: 700,
  /** Pause after the firewall blocks. */
  BLOCK_PAUSE_MS: 15 * 60 * 1000,
  /** An authorized NFC-e never changes: the result is cached by access key. */
  CACHE_TTL_MS: 60 * 24 * 60 * 60 * 1000,
});

/** URLs the service worker agrees to fetch for the content script. */
export const ALLOWED_URLS = Object.freeze([...SEFAZ.URLS, /^https:\/\/[a-z0-9-]+\.blob\.core\.windows\.net\//i]);

/** Headers the service worker forwards (used by the SIGA viewer on Azure Blob). */
export const ALLOWED_HEADERS = Object.freeze(new Set(['authorization', 'x-ms-date', 'x-ms-version']));
