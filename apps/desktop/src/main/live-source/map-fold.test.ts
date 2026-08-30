import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveTick } from '@bombfarm/contracts';
import { propCountForPhase } from '@bombfarm/domain/phase-wiki';
import { describe, expect, it } from 'vitest';
import { readCaptureRecords, type CaptureRecord } from './capture-format.js';
import { MapFold } from './map-fold.js';
import { TlsConnections, type TapEvent } from './tls-stream.js';

function baseTick(overrides: Partial<LiveTick> = {}): LiveTick {
  return { heroes: [], ...overrides };
}

function makeFold(propsTotalForPhase: (phase: number) => number | null = () => 50): MapFold {
  return new MapFold({ propsTotalForPhase });
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
    const fold = makeFold((phase) => (phase === 61 ? 75 : null));
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

describe('MapFold against the committed capture', () => {
  it('tracks a real clear down to its last prop and back up on the wave rollover', () => {
    const ticks = replayCommittedCaptureTicks();
    const fold = makeFold(propCountForPhase);

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
    const fold = makeFold(propCountForPhase);
    ticks.forEach((tick, index) => {
      fold.consumeTick(tick, index + 1);
    });

    expect(fold.current).toMatchObject({ phase: 61, propsAlive: 75, propsTotal: 75 });
  });

  it('holds health inside [0, 1] on every tick, and reports full health on the fresh map', () => {
    const ticks = replayCommittedCaptureTicks();
    const fold = makeFold(propCountForPhase);

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
