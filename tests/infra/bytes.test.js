import { describe, it, expect } from 'vitest';
import { base64ToBytes, bytesToBase64, latin1 } from '../../src/infra/bytes.js';

describe('byte conversions', () => {
  it('base64ToBytes', () => {
    expect([...base64ToBytes(btoa('ABÿ'))]).toEqual([65, 66, 255]);
  });
  it('latin1 keeps each byte as one character', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);
    const s = latin1(bytes);
    expect(s.length).toBe(70000);
    expect(s.charCodeAt(255)).toBe(255);
    expect(s.charCodeAt(69999)).toBe(69999 % 256);
  });

  it('bytesToBase64 does the reverse', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
});
