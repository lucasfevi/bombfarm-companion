import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import { countLootPayouts, GridClearCounter } from '@bombfarm/domain/live';

const tick = (partial: Partial<LiveTick>): LiveTick => ({ heroes: [], ...partial });

describe('countLootPayouts', () => {
  it('counts the props that carry a gold figure and sums their gold', () => {
    expect(countLootPayouts(tick({ loot: [{ cell: 0, gold: 100 }, { cell: 1, gold: 50 }] }))).toEqual({ props: 2, gold: 150 });
  });

  it('skips an entry without a finite gold figure', () => {
    const loot = [{ cell: 0 }, { cell: 1, gold: Number.NaN }, { cell: 2, gold: Number.POSITIVE_INFINITY }, { cell: 3, gold: 7 }];
    expect(countLootPayouts(tick({ loot }))).toEqual({ props: 1, gold: 7 });
  });

  it('is zero for a tick with no loot list', () => {
    expect(countLootPayouts(tick({}))).toEqual({ props: 0, gold: 0 });
  });
});

describe('GridClearCounter', () => {
  it('has nothing to diff on the first tick', () => {
    const counter = new GridClearCounter();
    expect(counter.observe(tick({ wave: 1, kinds: [0, 0] }), 0)).toEqual({ clears: 0, ran: false });
    expect(counter.totals).toEqual({ gridClears: 0, payoutProps: 0 });
  });

  it('counts occupied-to-cleared cells and the payouts of that same tick', () => {
    const counter = new GridClearCounter();
    counter.observe(tick({ wave: 1, kinds: [0, 0, -1] }), 0);
    expect(counter.observe(tick({ wave: 1, kinds: [-1, 0, -1] }), 1)).toEqual({ clears: 1, ran: true });
    expect(counter.totals).toEqual({ gridClears: 1, payoutProps: 1 });
  });

  it('does not count a cell that was already empty, or one that becomes occupied', () => {
    const counter = new GridClearCounter();
    counter.observe(tick({ wave: 1, kinds: [-1, -1] }), 0);
    expect(counter.observe(tick({ wave: 1, kinds: [-1, 0] }), 0)).toEqual({ clears: 0, ran: true });
  });

  it('wave guard: a wave rollover is not read as clears, and its payouts are not counted', () => {
    const counter = new GridClearCounter();
    counter.observe(tick({ wave: 1, kinds: [0, -1, 0] }), 0);
    expect(counter.observe(tick({ wave: 2, kinds: [-1, 0, 0] }), 3)).toEqual({ clears: 0, ran: false });
    expect(counter.totals).toEqual({ gridClears: 0, payoutProps: 0 });
    // The rolled-over grid is the new baseline for the next diff.
    expect(counter.observe(tick({ wave: 2, kinds: [-1, -1, 0] }), 1)).toEqual({ clears: 1, ran: true });
    expect(counter.totals).toEqual({ gridClears: 1, payoutProps: 1 });
  });

  it('counts payouts only where the diff ran: a tick without kinds adds none', () => {
    const counter = new GridClearCounter();
    counter.observe(tick({ wave: 1, kinds: [0] }), 0);
    expect(counter.observe(tick({ wave: 1 }), 2)).toEqual({ clears: 0, ran: false });
    expect(counter.totals).toEqual({ gridClears: 0, payoutProps: 0 });
  });

  it('a clear with no matching payout shows as a divergence in the totals', () => {
    const counter = new GridClearCounter();
    counter.observe(tick({ wave: 1, kinds: [0] }), 0);
    counter.observe(tick({ wave: 1, kinds: [-1] }), 0);
    expect(counter.totals).toEqual({ gridClears: 1, payoutProps: 0 });
  });

  it('reset clears the totals and forgets the previous grid', () => {
    const counter = new GridClearCounter();
    counter.observe(tick({ wave: 1, kinds: [0] }), 0);
    counter.observe(tick({ wave: 1, kinds: [-1] }), 1);
    counter.reset();
    expect(counter.totals).toEqual({ gridClears: 0, payoutProps: 0 });
    expect(counter.observe(tick({ wave: 1, kinds: [-1] }), 0)).toEqual({ clears: 0, ran: false });
  });
});
