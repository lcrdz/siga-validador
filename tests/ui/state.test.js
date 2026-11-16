import { describe, it, expect } from 'vitest';
import * as stateFns from '../../src/ui/state.js';

const entry = (n) => ({ code: `C${n}`, number: String(n), date: 'd', docNumber: 'x', supplier: 'F', amount: '1,00' });
const res = (n, status, extra = {}) => ({
  entry: entry(n),
  status,
  message: '',
  checks: null,
  imageUrl: null,
  queryUrl: null,
  ...extra,
});

describe('panel state', () => {
  it('starts empty', () => {
    const e = stateFns.createState();
    expect(e).toMatchObject({ entries: [], filter: null, onlyPending: false, running: false, batchSize: 0 });
    expect(stateFns.progress(e)).toEqual({ fraction: 0, text: '0 lançamentos conferidos' });
  });

  it('tracks a full batch', () => {
    const e = stateFns.createState();
    stateFns.start(e, [entry(1), entry(2), entry(3), entry(4)]);
    expect(e.running).toBe(true);
    expect(stateFns.progress(e)).toEqual({ fraction: 0, text: '0 de 4' });
    stateFns.record(e, res(1, 'ok'));
    stateFns.record(e, res(2, 'divergent'));
    stateFns.record(e, res(3, 'error', { sefazBlocked: true, message: 'pausa' }));
    expect(stateFns.progress(e)).toEqual({ fraction: 0.75, text: '3 de 4' });
    expect(stateFns.statusOf(e, entry(4))).toBe('pending');
    stateFns.record(e, res(4, 'manual'));
    stateFns.finish(e);
    expect(e.running).toBe(false);
    expect(stateFns.progress(e).text).toBe('4 lançamentos conferidos');
    expect(stateFns.counts(e)).toEqual({ ok: 1, divergent: 1, manual: 1, error: 1 });
    expect(stateFns.entriesWithError(e).map((l) => l.number)).toEqual(['3']);
    expect(stateFns.sefazBlock(e)?.message).toBe('pausa');
  });

  it('a new validation discards previous results and clears the filter', () => {
    const e = stateFns.createState();
    stateFns.start(e, [entry(1)]);
    stateFns.record(e, res(1, 'ok'));
    stateFns.toggleFilter(e, 'ok');
    const discarded = stateFns.start(e, [entry(2)]);
    expect(discarded.map((r) => r.entry.number)).toEqual(['1']);
    expect(e.results.size).toBe(0);
    expect(e.filter).toBeNull();
  });

  it('partial revalidation keeps the other results', () => {
    const e = stateFns.createState();
    stateFns.start(e, [entry(1), entry(2), entry(3)]);
    stateFns.record(e, res(1, 'ok'));
    stateFns.record(e, res(2, 'error'));
    stateFns.record(e, res(3, 'error'));
    stateFns.finish(e);
    stateFns.toggleFilter(e, 'error');
    const discarded = stateFns.startPartial(e, stateFns.entriesWithError(e));
    expect(discarded.map((r) => r.entry.number)).toEqual(['2', '3']);
    expect([...e.results.keys()]).toEqual(['1']);
    expect(e.filter).toBeNull();
    expect(stateFns.progress(e)).toEqual({ fraction: 0, text: 'Revalidando erros: 0 de 2' });
    stateFns.record(e, res(2, 'ok'));
    stateFns.record(e, res(3, 'error'));
    stateFns.finish(e);
    expect(stateFns.progress(e).text).toBe('2 erros revalidados · 3 lançamentos no total');
  });

  it('filters: chip and "only what needs attention"', () => {
    const e = stateFns.createState();
    stateFns.start(e, [entry(1), entry(2), entry(3)]);
    stateFns.record(e, res(1, 'ok'));
    stateFns.record(e, res(2, 'divergent'));
    expect(stateFns.visible(e)).toHaveLength(3);
    stateFns.toggleFilter(e, 'divergent');
    expect(stateFns.visible(e).map((l) => l.number)).toEqual(['2']);
    stateFns.toggleFilter(e, 'divergent');
    e.onlyPending = true;
    expect(stateFns.visible(e).map((l) => l.number)).toEqual(['2']); // hides OK and "queued"
  });

  it('singular text for one revalidated error', () => {
    const e = stateFns.createState();
    stateFns.start(e, [entry(1)]);
    stateFns.record(e, res(1, 'error'));
    stateFns.finish(e);
    stateFns.startPartial(e, [entry(1)]);
    stateFns.record(e, res(1, 'ok'));
    stateFns.finish(e);
    expect(stateFns.progress(e).text).toBe('1 erro revalidado · 1 lançamentos no total');
  });
});
