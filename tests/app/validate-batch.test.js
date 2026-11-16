import { describe, it, expect, vi } from 'vitest';
import { inBatches, validateBatch } from '../../src/app/validate-batch.js';

describe('inBatches', () => {
  it('processes every item within the concurrency limit', async () => {
    let activeOnes = 0;
    let peak = 0;
    const seen = [];
    await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (item, i) => {
      activeOnes++;
      peak = Math.max(peak, activeOnes);
      await new Promise((r) => setTimeout(r, 5));
      seen.push([item, i]);
      activeOnes--;
    });
    expect(peak).toBe(3);
    expect(seen.map(([item]) => item).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(seen.every(([item, i]) => item === i + 1)).toBe(true);
  });
  it('does nothing with an empty list', async () => {
    const fn = vi.fn();
    await inBatches([], 4, fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('validateBatch', () => {
  it('validates each entry with the settings and reports each result', async () => {
    const cfg = { consumerCnpj: 'x', paymentMethod: 'y' };
    const seen = [];
    const validate = vi.fn(async (l, c) => ({ entry: l, status: 'ok', cfg: c }));
    await validateBatch([{ number: '1' }, { number: '2' }, { number: '3' }], {
      validate,
      cfg,
      concurrency: 2,
      onValidate: (r) => seen.push(r.entry.number),
    });
    expect(seen.sort()).toEqual(['1', '2', '3']);
    expect(validate.mock.calls.every(([, c]) => c === cfg)).toBe(true);
  });

  it('uses the default concurrency of 4', async () => {
    let activeOnes = 0;
    let peak = 0;
    const validate = async (l) => {
      activeOnes++;
      peak = Math.max(peak, activeOnes);
      await new Promise((r) => setTimeout(r, 5));
      activeOnes--;
      return { entry: l };
    };
    await validateBatch(
      Array.from({ length: 10 }, (_, i) => ({ number: String(i) })),
      { validate, cfg: {}, onValidate: () => {} },
    );
    expect(peak).toBe(4);
  });
});
