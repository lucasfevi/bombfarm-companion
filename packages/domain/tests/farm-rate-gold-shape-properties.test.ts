/**
 * The gold objective's SHAPE, over seeded synthetic squads rather than any captured account.
 *
 * Three claims, each true for every account because it follows from where the terms sit in
 * `buildRow` rather than from any one roster's numbers:
 *
 *   - gold/hr never falls when a hero hits harder;
 *   - between two consecutive hits-to-kill steps it does not move at all;
 *   - Sorte is not one of its terms.
 *
 * The hits-to-kill ladder a phase presents is `ceil(hp / hit)` over the distinct prop HPs, plus
 * the boss's on a gate phase — a gate's clear pays `1 / bossPerSec` on top of the props, so the
 * boss's own integer steps are steps of the gold row too.
 */
import { describe, expect, it } from 'vitest';
import {
  computeFarmRateRow,
  computeSquadFarmFacts,
  type HeroFarmFacts,
  type SquadFarmAccount,
} from '@bombfarm/domain/farm-rate';
import { BOSS_HP_MULT_WIKI, WIKI_PHASE_LINES, WIKI_PROPS, wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { propHp } from '@bombfarm/domain/phases';
import { BASE_BLAST_RANGE, FUSE_FLOOR, STAT_CAPS, mitigationFactor } from '@bombfarm/domain/model';
import { mulberry32 } from './helpers/seeded-random';

const PHASE_COUNT = WIKI_PHASE_LINES.length;

const ACCOUNT: SquadFarmAccount = {
  slots: 3,
  fieldSlots: 3,
  tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0, xpMult: 1 },
};

/** A hero with no crit roll, no Estilhaços and a blast that stops at the base cross, so its only
 *  route into the row is the hit itself. Overrides opt each of those back in. */
function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 1000,
    penetrationPct: 0,
    fuseSecs: 1.2,
    fuseFloorSecs: FUSE_FLOOR,
    cdrCapPct: STAT_CAPS.cdr,
    walkSpeedCells: 3,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1 + 0.5 * BASE_BLAST_RANGE,
    blastCells: 1 + 4 * BASE_BLAST_RANGE,
    uptime: 0.6,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

function goldPerHour(phase: number, heroes: readonly HeroFarmFacts[]): number {
  return computeFarmRateRow(phase, computeSquadFarmFacts(heroes, ACCOUNT))!.goldPerHour;
}

/** Every HP a hit is measured against at this phase, ascending and deduplicated. */
function targetHps(phase: number): number[] {
  const line = wikiPhaseLine(phase)!;
  const hps = WIKI_PROPS.map((prop) => propHp(line.hp, prop.hpMult));
  if (line.gate) hps.push(propHp(line.hp, BOSS_HP_MULT_WIKI));
  return [...new Set(hps)].sort((left, right) => left - right);
}

/** The widest run of post-mitigation hits around `hit` over which `ceil(hp / hit)` is unchanged
 *  for every target: open below, closed above. `hi` is `Infinity` once one hit kills everything. */
function sameHtkInterval(hps: readonly number[], hit: number): { lo: number; hi: number } {
  let lo = 0;
  let hi = Infinity;
  for (const hp of hps) {
    const htk = Math.ceil(hp / hit);
    lo = Math.max(lo, hp / htk);
    if (htk > 1) hi = Math.min(hi, hp / (htk - 1));
  }
  return { lo, hi };
}

function htkVector(hps: readonly number[], hit: number): number[] {
  return hps.map((hp) => Math.ceil(hp / hit));
}

function reportEmpty(label: string, regressions: readonly string[]): void {
  expect(regressions, `${label}\n${regressions.join('\n')}`).toEqual([]);
}

describe('gold/hr never falls when a hero hits harder', () => {
  const SEEDS = [0x5eed01, 0x5eed02, 0x5eed03];

  it('a solo hero walked up to 21x its hit in 80 steps, at 30 phases per seed', () => {
    const regressions: string[] = [];
    for (const seed of SEEDS) {
      const rand = mulberry32(seed);
      for (let sample = 0; sample < 30; sample++) {
        const phase = 1 + Math.floor(rand() * PHASE_COUNT);
        const opening = targetHps(phase)[0] / (5 + rand() * 60);
        let previousHit = 0;
        let previousGold = -Infinity;
        let openingGold = 0;
        for (let step = 0; step < 80; step++) {
          const avgHitBase = opening * Math.pow(1.04, step);
          const gold = goldPerHour(phase, [syntheticHero({ heroId: 'solo', avgHitBase })]);
          if (step === 0) openingGold = gold;
          if (gold < previousGold) {
            regressions.push(
              `seed 0x${seed.toString(16)} phase ${phase}: hit ${previousHit.toFixed(3)} -> ${avgHitBase.toFixed(3)} dropped gold/hr ${previousGold} -> ${gold} (${(previousGold - gold).toExponential(3)} lost)`,
            );
          }
          previousHit = avgHitBase;
          previousGold = gold;
        }
        if (!(previousGold > openingGold)) {
          regressions.push(
            `seed 0x${seed.toString(16)} phase ${phase}: 21x the hit left gold/hr at ${openingGold} -> ${previousGold}, so the sweep proves nothing`,
          );
        }
      }
    }
    reportEmpty('gold/hr fell as a hero hit harder:', regressions);
  });

  it('one hero of six rises while the House can only feed three', () => {
    const regressions: string[] = [];
    for (const seed of SEEDS) {
      const rand = mulberry32(seed ^ 0xf00d);
      for (let sample = 0; sample < 12; sample++) {
        const phase = 1 + Math.floor(rand() * PHASE_COUNT);
        const opening = targetHps(phase)[0];
        const squad = [0, 1, 2, 3, 4, 5].map((index) =>
          syntheticHero({
            heroId: `hero${index}`,
            uptime: 0.2 + rand() * 0.7,
            fuseSecs: 0.5 + rand() * 2,
            walkSpeedCells: 1 + rand() * 5,
            plantsPerSec: 0.2 + rand() * 1.5,
            penetrationPct: rand() * 30,
            avgHitBase: opening / (5 + rand() * 60),
          }),
        );
        const target = Math.floor(rand() * squad.length);
        let previousGold = -Infinity;
        let openingGold = 0;
        for (let step = 0; step < 60; step++) {
          const scale = Math.pow(1.05, step);
          const raised = squad.map((hero, index) =>
            index === target ? { ...hero, avgHitBase: hero.avgHitBase * scale } : hero,
          );
          const gold = goldPerHour(phase, raised);
          if (step === 0) openingGold = gold;
          if (gold < previousGold) {
            regressions.push(
              `seed 0x${seed.toString(16)} phase ${phase}: raising hero${target} to ${(squad[target].avgHitBase * scale).toFixed(3)} dropped gold/hr ${previousGold} -> ${gold}`,
            );
          }
          previousGold = gold;
        }
        if (!(previousGold > openingGold)) {
          regressions.push(
            `seed 0x${seed.toString(16)} phase ${phase}: 17x hero${target}'s hit left gold/hr at ${openingGold} -> ${previousGold}, so the sweep proves nothing`,
          );
        }
      }
    }
    reportEmpty('gold/hr fell as one hero of a House-starved squad hit harder:', regressions);
  });

  it('a crit-rolling hero, whose hits-to-kill is an expectation rather than a ceiling', () => {
    const regressions: string[] = [];
    for (const seed of SEEDS) {
      const rand = mulberry32(seed ^ 0xc217);
      for (let sample = 0; sample < 12; sample++) {
        const phase = 1 + Math.floor(rand() * PHASE_COUNT);
        const opening = targetHps(phase)[0] / (5 + rand() * 60);
        const critChancePct = rand() * STAT_CAPS.critChance;
        const critDmgPct = 50 + rand() * 400;
        let previousGold = -Infinity;
        let openingGold = 0;
        for (let step = 0; step < 60; step++) {
          const hitNoCritBase = opening * Math.pow(1.05, step);
          const gold = goldPerHour(phase, [
            syntheticHero({
              heroId: 'crit',
              hitNoCritBase,
              avgHitBase: hitNoCritBase * (1 + (critChancePct / 100) * (critDmgPct / 100)),
              critChancePct,
              critDmgPct,
            }),
          ]);
          if (step === 0) openingGold = gold;
          if (gold < previousGold) {
            regressions.push(
              `seed 0x${seed.toString(16)} phase ${phase}: non-crit hit ${hitNoCritBase.toFixed(3)} at ${critChancePct.toFixed(1)}%/${critDmgPct.toFixed(0)}% crit dropped gold/hr ${previousGold} -> ${gold}`,
            );
          }
          previousGold = gold;
        }
        if (!(previousGold > openingGold)) {
          regressions.push(
            `seed 0x${seed.toString(16)} phase ${phase}: 17x the non-crit hit left gold/hr at ${openingGold} -> ${previousGold}, so the sweep proves nothing`,
          );
        }
      }
    }
    reportEmpty('gold/hr fell as a crit-rolling hero hit harder:', regressions);
  });
});

describe('between two hits-to-kill steps, gold/hr does not move at all', () => {
  const SEEDS = [0x571a, 0x571b, 0x571c];
  const INTERIOR = [0.05, 0.2, 0.5, 0.9];
  /** A step near 400 hits-to-kill is narrower than the doubles that address it, so an interval
   *  that thin has no four distinct interior hits to read. Skipped, not widened. */
  const SAMPLEABLE_WIDTH = 1e-6;

  it('four hits inside one interval give the same gold/hr, bit for bit, for a hero that never crits', () => {
    const regressions: string[] = [];
    let intervals = 0;
    for (const seed of SEEDS) {
      const rand = mulberry32(seed);
      for (let sample = 0; sample < 60; sample++) {
        const phase = 1 + Math.floor(rand() * PHASE_COUNT);
        const line = wikiPhaseLine(phase)!;
        const mitigation = mitigationFactor(line.mitig, 0);
        const hps = targetHps(phase);
        const probe = hps[0] / (2 + Math.floor(rand() * 80));
        const { lo, hi } = sameHtkInterval(hps, probe);
        if (!Number.isFinite(hi) || hi - lo < lo * SAMPLEABLE_WIDTH) continue;
        intervals++;

        const hits = INTERIOR.map((fraction) => lo + (hi - lo) * fraction);
        const vector = htkVector(hps, hits[0]).join(',');
        for (const hit of hits.slice(1)) {
          const other = htkVector(hps, hit).join(',');
          expect(other, `interval (${lo}, ${hi}] is not one hits-to-kill step at phase ${phase}`).toBe(vector);
        }

        const golds = hits.map((hit) => goldPerHour(phase, [syntheticHero({ heroId: 'solo', avgHitBase: hit / mitigation })]));
        if (!golds.every((gold) => gold > 0)) {
          regressions.push(`seed 0x${seed.toString(16)} phase ${phase}: gold/hr read ${golds.join(' / ')}, so the equality below proves nothing`);
        }
        if (new Set(golds).size !== 1) {
          regressions.push(
            `seed 0x${seed.toString(16)} phase ${phase} gate=${line.gate}: hits-to-kill [${vector}] held over (${lo}, ${hi}] but gold/hr read ${golds.join(' / ')}`,
          );
        }
      }
    }
    expect(intervals).toBeGreaterThan(100);
    reportEmpty('gold/hr moved without a hits-to-kill step:', regressions);
  });

  it('crossing the top of the interval raises it — the plateau above is not a flat function', () => {
    const regressions: string[] = [];
    let crossings = 0;
    for (const seed of SEEDS) {
      const rand = mulberry32(seed ^ 0x2222);
      for (let sample = 0; sample < 40; sample++) {
        const phase = 1 + Math.floor(rand() * PHASE_COUNT);
        const line = wikiPhaseLine(phase)!;
        const mitigation = mitigationFactor(line.mitig, 0);
        const hps = targetHps(phase);
        const probe = hps[0] / (2 + Math.floor(rand() * 80));
        const { lo, hi } = sameHtkInterval(hps, probe);
        if (!Number.isFinite(hi) || hi - lo < lo * SAMPLEABLE_WIDTH) continue;
        crossings++;

        const below = goldPerHour(phase, [syntheticHero({ heroId: 'solo', avgHitBase: (lo + (hi - lo) * 0.9) / mitigation })]);
        const above = goldPerHour(phase, [syntheticHero({ heroId: 'solo', avgHitBase: (hi * 1.0000001) / mitigation })]);
        if (!(above > below)) {
          regressions.push(
            `seed 0x${seed.toString(16)} phase ${phase} gate=${line.gate}: crossing the step at ${hi} left gold/hr at ${below} -> ${above}`,
          );
        }
      }
    }
    expect(crossings).toBeGreaterThan(60);
    reportEmpty('a hits-to-kill step bought nothing:', regressions);
  });
});

describe('Sorte is not a term of gold/hr', () => {
  it('hero Sorte and the tree flat share leave gold/hr bit-identical while chests/hr rises', () => {
    const rand = mulberry32(0x507e5);
    const regressions: string[] = [];
    for (let sample = 0; sample < 60; sample++) {
      const phase = 1 + Math.floor(rand() * PHASE_COUNT);
      const plain = syntheticHero({
        heroId: 'plain',
        avgHitBase: targetHps(phase)[0] / (3 + rand() * 40),
        uptime: 0.4 + rand() * 0.5,
      });
      const lucky = { ...plain, heroLuckPct: 10 + rand() * 200 };
      const luckyAccount: SquadFarmAccount = { ...ACCOUNT, tree: { ...ACCOUNT.tree, luckFlatPct: 25 } };

      const before = computeFarmRateRow(phase, computeSquadFarmFacts([plain], ACCOUNT))!;
      const after = computeFarmRateRow(phase, computeSquadFarmFacts([lucky], luckyAccount))!;

      if (!(before.goldPerHour > 0)) {
        regressions.push(`phase ${phase}: gold/hr is ${before.goldPerHour}, so its invariance proves nothing`);
      }
      if (before.goldPerHour !== after.goldPerHour) {
        regressions.push(`phase ${phase}: Sorte moved gold/hr ${before.goldPerHour} -> ${after.goldPerHour}`);
      }
      if (!(after.chestsPerHour > before.chestsPerHour)) {
        regressions.push(`phase ${phase}: Sorte left chests/hr at ${before.chestsPerHour} -> ${after.chestsPerHour}`);
      }
    }
    reportEmpty('Sorte reached gold/hr, or failed to reach chests/hr:', regressions);
  });
});
