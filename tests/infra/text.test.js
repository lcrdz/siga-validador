import { describe, it, expect } from 'vitest';
import { esc, htmlToText, text } from '../../src/infra/text.js';

describe('text / htmlToText', () => {
  it('normalizes whitespace', () => {
    const el = document.createElement('div');
    el.innerHTML = '  a \n\t b  ';
    expect(text(el)).toBe('a b');
    expect(text(null)).toBe('');
  });
  it('removes tags', () => {
    expect(htmlToText('<b>MERCADO</b> <i>X</i>')).toBe('MERCADO X');
  });
});

describe('esc', () => {
  it('escapes HTML characters', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(esc(null)).toBe('');
  });
});
