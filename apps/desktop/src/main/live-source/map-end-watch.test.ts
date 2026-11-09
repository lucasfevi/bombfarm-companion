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

describe('MapEndWatch — a map ends when the wave steps up by one between two frames that name a map', () => {
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

  it('the first frame only sets the baseline', () => {
    expect(ends([{ phase: 120, wave: 9 }])).toEqual([]);
  });

  it('advancing to the next phase ends a map too, logged under the phase that was played', () => {
    expect(ends([{ phase: 120, wave: 4 }, { phase: 121, wave: 5 }])).toEqual([{ wave: 4, phase: 120 }]);
  });

  it('frames naming no map in between keep the baseline, and a step of one across them logs', () => {
    expect(ends([{ phase: 120, wave: 4 }, {}, { phase: 120 }, { wave: 5 }, { phase: -1, wave: 5 }, { phase: 120, wave: 5 }])).toEqual([
      { wave: 4, phase: 120 },
    ]);
  });

  it('a step of two is not a map end, nor is a counter going back; both only move the baseline', () => {
    expect(ends([{ phase: 120, wave: 4 }, { phase: 120, wave: 6 }])).toEqual([]);
    expect(ends([{ phase: 120, wave: 4 }, { phase: 120, wave: 6 }, { phase: 120, wave: 2 }, { phase: 120, wave: 3 }])).toEqual([
      { wave: 2, phase: 120 },
    ]);
  });

  it('forgets the baseline on reset', () => {
    const watch = new MapEndWatch();
    watch.observe(tick({ phase: 120, wave: 4 }));
    watch.reset();
    expect(watch.observe(tick({ phase: 120, wave: 5 }))).toBeNull();
  });
});
