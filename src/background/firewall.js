// @ts-check
// Detects when the SEFAZ firewall answered instead of the query page.

const BLOCKED = /requested URL was rejected|Request Rejected|support ID is/i;
// Markers of the real query page (invoice data or error notice).
const QUERY_PAGE = /id=["']?(conteudo|totalNota|avisos)\b/i;

/**
 * Block page ("The requested URL was rejected...") or JavaScript
 * challenge (only <script>, no query page) that the firewall sometimes
 * returns before blocking for good. The extension does not run the challenge.
 * @param {string} text
 * @returns {boolean}
 */
export function isFirewallResponse(text) {
  return BLOCKED.test(text) || (!QUERY_PAGE.test(text) && /<script/i.test(text));
}
