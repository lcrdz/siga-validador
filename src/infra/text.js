// @ts-check
// Reading text from elements and HTML.

/**
 * Text of an element with normalized whitespace.
 * @param {Element | null | undefined} el
 * @returns {string}
 */
export function text(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Text of an HTML snippet (without tags).
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  return text(new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body);
}

/**
 * Escapes text for insertion into HTML.
 * @param {unknown} s
 * @returns {string}
 */
export function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
}
