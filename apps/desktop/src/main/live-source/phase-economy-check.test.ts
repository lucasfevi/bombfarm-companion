import type { PhaseEconomy } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';
import type { LogPort } from './log-port.js';
import { PHASE_ECONOMY_BURST_GAP_MS, PhaseEconomyCheck, wikiPhaseEconomyBaseline } from './phase-economy-check.js';

function economy(phase: number, goldPerProp: number, xpPerProp: number): PhaseEconomy {
  return {
    phase,
    goldPerProp,
    xpPerProp,
    goldMult: null,
    xpMult: null,
    itemLevelMin: 30,
    itemLevelMax: 30,
    chestChancePct: 0.12,
    keyChancePct: 0.12,
    gemChancePct: null,
    stoneChancePct: null,
    timeChancePct: null,
    cageCeilingPct: 10,
  };
}

/** Bursts as the server sent them, per phase `[phase, gold per prop, xp per prop]`: a 1.56× XP
 *  account on phases 51-60, the same account later on phases 81-90, and a Boosted burst on
 *  phases 1-10 whose low-phase gold is too small to check. */
type Burst = readonly (readonly [number, number, number])[];

function withPhase(burst: Burst, phase: number, shift: { readonly gold?: number; readonly xp?: number }): Burst {
  return burst.map(([p, gold, xp]) => (p === phase ? [p, gold + (shift.gold ?? 0), xp + (shift.xp ?? 0)] : [p, gold, xp]));
}

const BURST_PHASES_51_60: Burst = [
  [51, 813, 261], [52, 829, 265], [53, 846, 270], [54, 862, 275], [55, 878, 279],
  [57, 911, 289], [58, 928, 293], [59, 944, 298], [60, 961, 303],
];
const BURST_PHASES_81_90: Burst = [
  [81, 2064, 428], [82, 2090, 433], [83, 2116, 438], [84, 2142, 443], [85, 2168, 448],
  [86, 2194, 453], [87, 2220, 458], [88, 2246, 463], [89, 2272, 468], [90, 2298, 473],
];
const BURST_PHASES_1_10: Burst = [
  [1, 5, 64], [2, 33, 75], [3, 61, 86], [4, 88, 96], [5, 116, 107],
  [6, 143, 118], [7, 171, 128], [8, 199, 139], [9, 226, 150], [10, 254, 160],
];

function recordingLog(): LogPort & { readonly warns: Record<string, unknown>[] } {
  const warns: Record<string, unknown>[] = [];
  return { warns, info: () => undefined, warn: (record) => warns.push(record) };
}

function harness() {
  let now = 0;
  const log = recordingLog();
  const check = new PhaseEconomyCheck({ now: () => now, wikiBaseline: wikiPhaseEconomyBaseline, log });
  return {
    log,
    advance: (ms: number) => {
      now += ms;
    },
    feed: (burst: Burst) => {
      for (const [phase, gold, xp] of burst) check.observe(economy(phase, gold, xp));
    },
  };
}

describe('PhaseEconomyCheck: bursts that agree with the bundle', () => {
  it.each([
    ['phases 51-60', BURST_PHASES_51_60],
    ['phases 81-90', BURST_PHASES_81_90],
    ['phases 1-10', BURST_PHASES_1_10],
  ])('stays quiet on %s', (_label, burst) => {
    const { log, feed } = harness();
    feed(burst);

    expect(log.warns).toEqual([]);
  });
});

describe('PhaseEconomyCheck: a phase the bundle no longer matches', () => {
  it('warns once for a phase whose XP left the shared factor', () => {
    const { log, feed } = harness();
    feed(withPhase(BURST_PHASES_81_90, 85, { xp: 40 }));

    expect(log.warns).toHaveLength(1);
    expect(log.warns[0]).toMatchObject({ event: 'phase_economy.wiki_mismatch', axis: 'xp', phase: 85, server: 488 });
  });

  it('warns for a phase whose gold left the shared factor', () => {
    const { log, feed } = harness();
    feed(withPhase(BURST_PHASES_51_60, 55, { gold: 40 }));

    expect(log.warns).toEqual([expect.objectContaining({ axis: 'gold', phase: 55, server: 918 })]);
  });

  it('flags the same phase again in a later burst', () => {
    const { log, feed, advance } = harness();
    const drifted = withPhase(BURST_PHASES_81_90, 85, { xp: 40 });
    feed(drifted);
    advance(PHASE_ECONOMY_BURST_GAP_MS + 1);
    feed(drifted);

    expect(log.warns.filter((record) => record.event === 'phase_economy.wiki_mismatch')).toHaveLength(2);
  });
});

describe('PhaseEconomyCheck: what it cannot judge', () => {
  it('does not compare two bursts sent under different multipliers', () => {
    const { log, feed, advance } = harness();
    feed(BURST_PHASES_51_60.slice(0, 2));
    advance(PHASE_ECONOMY_BURST_GAP_MS + 1);
    feed(BURST_PHASES_51_60.slice(2, 3).map(([phase, gold, xp]) => [phase, gold * 2, xp * 2]));

    expect(log.warns).toEqual([]);
  });

  it('warns that a phase has no bundle row instead of guessing', () => {
    const { log, feed } = harness();
    feed([[9_999, 1, 1]]);

    expect(log.warns).toEqual([expect.objectContaining({ event: 'phase_economy.no_wiki_row', phase: 9_999 })]);
  });
});
