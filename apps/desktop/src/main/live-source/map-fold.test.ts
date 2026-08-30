import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveTick } from '@bombfarm/contracts';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { describe, expect, it } from 'vitest';
import { readCaptureRecords, type CaptureRecord } from './capture-format.js';
import { MapFold, type MapAccountBoosts, type MapWikiFacts } from './map-fold.js';
import { TlsConnections, type TapEvent } from './tls-stream.js';

function baseTick(overrides: Partial<LiveTick> = {}): LiveTick {
  return { heroes: [], ...overrides };
}

const STUB_ECONOMY = { xpPerProp: 10, averageGoldPerProp: 100, averageGoldPerClear: 5_000 };

/** The production adapter, duplicated here rather than imported: `live-source.ts` keeps it
 *  private, and the capture cases below need the real wiki numbers, not a stub. */
function realWikiFactsFor(phase: number, boosts: MapAccountBoosts): MapWikiFacts | null {
  const intel = computePhaseIntelGlobal(phase, { teamCoinPct: boosts.teamCoinPct, xpMult: boosts.xpMult });
  if (!intel) return null;
  return {
    propsTotal: intel.propCount,
    economy: {
      xpPerProp: intel.xpPerPropActual,
      averageGoldPerProp: intel.weightedAvgGoldActual,
      averageGoldPerClear: intel.totalMapGoldActual,
    },
  };
}

function makeFold(
  wikiFactsFor: (phase: number, boosts: MapAccountBoosts) => MapWikiFacts | null = () => ({
    propsTotal: 50,
    economy: STUB_ECONOMY,
  }),
): MapFold {
  return new MapFold({ wikiFactsFor });
}

function isTick(event: TapEvent): event is { kind: 'tick'; tick: LiveTick } {
  return event.kind === 'tick';
}

/** The real decode path, records to ticks — the same replay `earnings-fold.test.ts` uses, so both
 *  folds are measured against identical traffic rather than against hand-written ticks. */
function replayCommittedCaptureTicks(): readonly LiveTick[] {
  const capturePath = resolve(__dirname, 'fixtures', 'live-capture.bfcc');
  const records: CaptureRecord[] = [...readCaptureRecords(readFileSync(capturePath))];
  const conn = new TlsConnections();
  const events: TapEvent[] = [];
  for (const record of records) events.push(...conn.push(record.ctx, record.bytes));
  return events.filter(isTick).map((event) => event.tick);
}

/** A grid of `cells` cells with the first `alive` of them occupied. */
function grid(cells: number, alive: number): readonly number[] {
  return Array.from({ length: cells }, (_unused, index) => (index < alive ? 1 : -1));
}

describe('MapFold: nothing to report before a phase arrives', () => {
  it('is null before any tick', () => {
    expect(makeFold().current).toBeNull();
  });

  it('stays null for a tick carrying health and a grid but no phase — those figures describe a map, and none has been named', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ roomHp: 128, kinds: grid(304, 20) }), 1);
    expect(fold.current).toBeNull();
  });
});

describe('MapFold: the reading it publishes', () => {
  it('rescales the wire 0-255 room health onto a [0, 1] fraction', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, roomHp: 255 }), 1);
    expect(fold.current?.healthFraction).toBe(1);

    fold.consumeTick(baseTick({ phase: 61, roomHp: 0 }), 2);
    expect(fold.current?.healthFraction).toBe(0);
  });

  it('clamps a health reading above the wire full scale instead of publishing a fraction over 1', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, roomHp: 400 }), 1);
    expect(fold.current?.healthFraction).toBe(1);
  });

  it('counts props from kinds, taking every non-negative entry as a prop still standing', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: [-1, 0, 4, -1, 9, -1] }), 1);
    expect(fold.current?.propsAlive).toBe(3);
  });

  it('counts a kind of 0 as a prop — the sentinel is -1, and 0 is a real prop type', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: [0, 0, -1] }), 1);
    expect(fold.current?.propsAlive).toBe(2);
  });

  it('reports 0 props alive, not null, for a fully cleared grid', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 0) }), 1);
    expect(fold.current?.propsAlive).toBe(0);
  });

  it('takes the props total from the phase, never from the grid it was sent', () => {
    const fold = makeFold((phase) => (phase === 61 ? { propsTotal: 75, economy: STUB_ECONOMY } : null));
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 10) }), 1);
    expect(fold.current).toMatchObject({ propsAlive: 10, propsTotal: 75 });
  });

  it('publishes a null total, and still a real alive count, for a phase the wiki cannot describe', () => {
    const fold = makeFold(() => null);
    fold.consumeTick(baseTick({ phase: 9_999, kinds: grid(304, 10) }), 1);
    expect(fold.current).toMatchObject({ phase: 9_999, propsAlive: 10, propsTotal: null });
  });
});

describe('MapFold: a figure a tick omits is carried, not blanked', () => {
  it('keeps the last health reading through a tick that omits roomHp', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, roomHp: 128 }), 1);
    fold.consumeTick(baseTick({ phase: 61 }), 2);
    expect(fold.current?.healthFraction).toBeCloseTo(128 / 255, 10);
  });

  it('keeps the last prop count through a tick that omits kinds', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 12) }), 1);
    fold.consumeTick(baseTick({ phase: 61 }), 2);
    expect(fold.current?.propsAlive).toBe(12);
  });

  it('keeps the last phase through a tick that omits it, rather than falling back to no map at all', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61 }), 1);
    fold.consumeTick(baseTick({ roomHp: 10 }), 2);
    expect(fold.current?.phase).toBe(61);
  });
});

describe('MapFold: sequence guard and reset', () => {
  it('ignores a tick whose sequence has already been seen', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 20) }), 2);
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 5) }), 2);
    expect(fold.current?.propsAlive).toBe(20);
  });

  it('ignores a tick that arrives out of order', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 20) }), 5);
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 5) }), 4);
    expect(fold.current?.propsAlive).toBe(20);
  });

  it('drops back to no reading at all after a reset, rather than keeping the old account’s map', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, roomHp: 128, kinds: grid(304, 20) }), 1);
    fold.reset();
    expect(fold.current).toBeNull();
  });

  it('accepts the same sequence again after a reset — the new stream restarts its own numbering', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61, kinds: grid(304, 20) }), 1);
    fold.reset();
    fold.consumeTick(baseTick({ phase: 22, kinds: grid(304, 7) }), 1);
    expect(fold.current).toMatchObject({ phase: 22, propsAlive: 7 });
  });
});

describe('MapFold: the map economy', () => {
  it('publishes the figures its wiki lookup returned', () => {
    const fold = makeFold();
    fold.consumeTick(baseTick({ phase: 61 }), 1);
    expect(fold.current?.economy).toEqual(STUB_ECONOMY);
  });

  it('publishes a null economy for a phase the wiki cannot describe, rather than zeros', () => {
    const fold = makeFold(() => null);
    fold.consumeTick(baseTick({ phase: 9_999 }), 1);
    expect(fold.current?.economy).toBeNull();
  });

  it('applies the account boosts, so the same phase is worth more to a boosted account', () => {
    const unboosted = makeFold(realWikiFactsFor);
    unboosted.consumeTick(baseTick({ phase: 61 }), 1);

    const boosted = makeFold(realWikiFactsFor);
    boosted.setAccountBoosts({ xpMult: 1.5821538462, teamCoinPct: 196.7708333 });
    boosted.consumeTick(baseTick({ phase: 61 }), 1);

    const plain = unboosted.current?.economy;
    const rich = boosted.current?.economy;
    expect(rich?.xpPerProp).toBeGreaterThan(plain?.xpPerProp ?? 0);
    expect(rich?.averageGoldPerProp).toBeGreaterThan(plain?.averageGoldPerProp ?? 0);
    expect(rich?.averageGoldPerClear).toBeGreaterThan(plain?.averageGoldPerClear ?? 0);
  });

  it('recomputes when the boosts change under an unchanged phase — the memo is keyed on both', () => {
    const fold = makeFold(realWikiFactsFor);
    fold.consumeTick(baseTick({ phase: 61 }), 1);
    const before = fold.current?.economy?.xpPerProp ?? 0;

    fold.setAccountBoosts({ xpMult: 2, teamCoinPct: 0 });
    const after = fold.current?.economy?.xpPerProp ?? 0;

    expect(after).toBeCloseTo(before * 2, 6);
  });

  it('recomputes when the phase changes under unchanged boosts', () => {
    const fold = makeFold(realWikiFactsFor);
    fold.consumeTick(baseTick({ phase: 1 }), 1);
    const early = fold.current?.economy?.averageGoldPerClear ?? 0;
    fold.consumeTick(baseTick({ phase: 600 }), 2);
    const late = fold.current?.economy?.averageGoldPerClear ?? 0;
    expect(late).toBeGreaterThan(early);
  });

  it('calls the wiki lookup once across many ticks on one phase, not once per tick', () => {
    let calls = 0;
    const fold = makeFold((phase, boosts) => {
      calls += 1;
      return realWikiFactsFor(phase, boosts);
    });
    for (let sequence = 1; sequence <= 50; sequence += 1) {
      fold.consumeTick(baseTick({ phase: 61, roomHp: 255 - sequence }), sequence);
      expect(fold.current?.economy).not.toBeNull();
    }
    expect(calls).toBe(1);
  });

  it('keeps the account boosts across a reset — a reset drops what the stream said, not what the account said', () => {
    const fold = makeFold(realWikiFactsFor);
    fold.setAccountBoosts({ xpMult: 2, teamCoinPct: 0 });
    fold.consumeTick(baseTick({ phase: 61 }), 1);
    const boosted = fold.current?.economy?.xpPerProp ?? 0;

    fold.reset();
    fold.consumeTick(baseTick({ phase: 61 }), 1);

    expect(fold.current?.economy?.xpPerProp).toBe(boosted);
  });

  it('matches the planner’s own figures for the same phase and boosts, so the two surfaces cannot drift', () => {
    const boosts: MapAccountBoosts = { xpMult: 1.5821538462, teamCoinPct: 196.7708333 };
    const fold = makeFold(realWikiFactsFor);
    fold.setAccountBoosts(boosts);
    fold.consumeTick(baseTick({ phase: 61 }), 1);

    const intel = computePhaseIntelGlobal(61, { xpMult: boosts.xpMult, teamCoinPct: boosts.teamCoinPct });
    expect(fold.current?.economy).toEqual({
      xpPerProp: intel?.xpPerPropActual,
      averageGoldPerProp: intel?.weightedAvgGoldActual,
      averageGoldPerClear: intel?.totalMapGoldActual,
    });
  });

  it('reports gold per clear as gold per prop across every prop the map spawns', () => {
    const fold = makeFold(realWikiFactsFor);
    fold.consumeTick(baseTick({ phase: 61 }), 1);
    const map = fold.current;
    expect(map?.economy?.averageGoldPerClear).toBeCloseTo(
      (map?.economy?.averageGoldPerProp ?? 0) * (map?.propsTotal ?? 0),
      6,
    );
  });
});

describe('MapFold against the committed capture', () => {
  it('tracks a real clear down to its last prop and back up on the wave rollover', () => {
    const ticks = replayCommittedCaptureTicks();
    const fold = makeFold(realWikiFactsFor);

    const alive: number[] = [];
    ticks.forEach((tick, index) => {
      fold.consumeTick(tick, index + 1);
      const propsAlive = fold.current?.propsAlive;
      if (propsAlive !== undefined && propsAlive !== null) alive.push(propsAlive);
    });

    expect(alive.length).toBe(ticks.length);
    expect(alive[0]).toBe(10);
    // The clear runs the map down to a single prop, then the wave rolls over and the next map's
    // full grid arrives — which is what a denominator read off the stream would have to wait for.
    expect(Math.min(...alive)).toBe(1);
    expect(alive[alive.length - 1]).toBe(75);
  });

  it('reads the capture’s phase, and its wiki prop total matches the count the fresh map actually spawned', () => {
    const ticks = replayCommittedCaptureTicks();
    const fold = makeFold(realWikiFactsFor);
    ticks.forEach((tick, index) => {
      fold.consumeTick(tick, index + 1);
    });

    expect(fold.current).toMatchObject({ phase: 61, propsAlive: 75, propsTotal: 75 });
  });

  it('holds health inside [0, 1] on every tick, and reports full health on the fresh map', () => {
    const ticks = replayCommittedCaptureTicks();
    const fold = makeFold(realWikiFactsFor);

    const readings: number[] = [];
    ticks.forEach((tick, index) => {
      fold.consumeTick(tick, index + 1);
      const health = fold.current?.healthFraction;
      if (health !== undefined && health !== null) readings.push(health);
    });

    expect(readings.length).toBe(ticks.length);
    for (const reading of readings) {
      expect(reading).toBeGreaterThanOrEqual(0);
      expect(reading).toBeLessThanOrEqual(1);
    }
    expect(readings[readings.length - 1]).toBe(1);
  });

  it('never reads occupancy off hps: that array carries no -1 on any captured tick, so the same test against it would call every cell a live prop', () => {
    const ticks = replayCommittedCaptureTicks();
    const withGrid = ticks.filter((tick) => tick.kinds !== undefined && tick.hps !== undefined);
    expect(withGrid.length).toBe(ticks.length);

    for (const tick of withGrid) {
      const hps = tick.hps ?? [];
      const kinds = tick.kinds ?? [];
      expect(hps.some((hp) => hp === -1)).toBe(false);
      expect(hps.length).toBe(kinds.length);
    }

    // The pair that makes the point: on the fresh map the two counts differ by the whole grid.
    const fresh = withGrid[withGrid.length - 1];
    expect((fresh?.kinds ?? []).filter((kind) => kind !== -1).length).toBe(75);
    expect((fresh?.hps ?? []).filter((hp) => hp !== -1).length).toBe(304);
  });
});
