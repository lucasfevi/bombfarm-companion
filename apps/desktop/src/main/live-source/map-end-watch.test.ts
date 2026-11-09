import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import { MapEndWatch, type MapEnd } from './map-end-watch.js';

function tick(fields: { phase?: number; wave?: number }): LiveTick {
  return { heroes: [], ...fields };
}

function ends(sequence: readonly { phase?: number; wave?: number }[]): MapEnd[] {
  const watch = new MapEndWatch();
  return sequence.map((fields) => watch.observe(tick(fields))).filter((end): end is MapEnd => end !== null);
}

describe('MapEndWatch — a map ends when the wave steps up by one within a phase', () => {
  it('reports each wave step once, naming the wave that ended', () => {
    expect(
      ends([
        { phase: 120, wave: 4 },
        { phase: 120, wave: 4 },
        { phase: 120, wave: 5 },
        { phase: 120, wave: 5 },
        { phase: 120, wave: 6 },
      ]),
    ).toEqual([
      { wave: 4, phase: 120 },
      { wave: 5, phase: 120 },
    ]);
  });

  it('the first tick only sets the baseline', () => {
    expect(ends([{ phase: 120, wave: 9 }])).toEqual([]);
  });

  it('a phase change is not a map end, even when the wave also steps by one', () => {
    expect(ends([{ phase: 120, wave: 4 }, { phase: 121, wave: 5 }])).toEqual([]);
  });

  it('a phase change on a tick with no wave drops the old phase’s wave from the baseline', () => {
    expect(ends([{ phase: 120, wave: 4 }, { phase: 121 }, { wave: 5 }])).toEqual([]);
  });

  it('a jump of more than one, or a counter going back, is not a map end', () => {
    expect(ends([{ phase: 120, wave: 4 }, { phase: 120, wave: 7 }, { phase: 120, wave: 2 }])).toEqual([]);
  });

  it('carries the phase and the wave forward across ticks that omit them', () => {
    expect(ends([{ phase: 120, wave: 4 }, {}, { phase: 120 }, { wave: 5 }])).toEqual([{ wave: 4, phase: 120 }]);
  });

  it('waits for a phase before reporting anything', () => {
    expect(ends([{ wave: 4 }, { wave: 5 }, { phase: 120, wave: 6 }, { wave: 7 }])).toEqual([{ wave: 6, phase: 120 }]);
  });

  it('forgets the baseline on reset', () => {
    const watch = new MapEndWatch();
    watch.observe(tick({ phase: 120, wave: 4 }));
    watch.reset();
    expect(watch.observe(tick({ phase: 120, wave: 5 }))).toBeNull();
  });
});
