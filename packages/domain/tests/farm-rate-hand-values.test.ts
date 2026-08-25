/**
 * Hand-computed fixture values.
 *
 * Two blocks: phase 42 (non-gate) and phase 10 (gate), each ato 1 on the 5-hero fixture. Every
 * expectation below is built from PUBLISHED INPUTS ONLY — the wiki line's own fields, the raw
 * `WIKI_PROPS` table, the exported constants, and the fixture's own `HeroFarmFacts` (obtained via
 * `computeHeroFarmFacts`/`computeSquadFarmFacts`, which T5 already proved independently). No
 * expectation here is built by calling `computeFarmRateRow` or `computeFarmRateTable` — only the
 * row under test is.
 *
 * DATA-STALENESS NOTE (precision gap, flagged for the validator): the design's illustrative
 * figures cited `goldComum 209.3469387755102` (phase 42) and `goldComum 46.734693877551024`
 * (phase 10), and `Σ share × goldRarityMult = 1.545`. The committed wiki bundle
 * (the 2026-08-14 pull, landed on this same branch) carries `goldComum 157` / `35` for
 * those two phases and a live `Σ share × goldRarityMult` of `1.57` — hp and mitig match the
 * design's figures exactly, only goldComum/the gold-share factor differ, consistent with the
 * wiki-bundle changeset's own note that "Phase gold is about 25% lower... the committed bundle
 * was simply stale." T7's own instruction is to derive expectations from PUBLISHED (i.e. live)
 * inputs, never from the design's now-stale illustrative figures — so every number below is read
 * live off `wikiPhaseLine` / `WIKI_PROPS`, never typed from the design's table.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateRow,
  FORTUNA_AURA_CAP,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import {
  wikiPhaseLine,
  WIKI_PROPS,
  DROP_RATES,
  KEY_GATE_COST,
  xpPerProp,
  propCountForAto,
  GATE_SECS_POR_ATO,
  BOSS_HP_MULT_WIKI,
  LOOT_ABILITY_VALUES,
} from '@bombfarm/domain/phase-wiki';
import { hitsToKill, propHp } from '@bombfarm/domain/phases';
import { mitigationFactor, EFF_IA } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const TOL = 1e-9; // relative tolerance — every input is an exact double (stated once, per T7).

const { heroes, account } = loadFarmRateFixture();
const heroFacts = computeHeroFarmFacts({ heroes, account });
const squad = computeSquadFarmFacts(heroFacts, account);

const propWeightTotal = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);
const goldShareFactor = WIKI_PROPS.reduce(
  (sum, prop) => sum + (prop.weight / propWeightTotal) * (1 + 0.4 * prop.rarity),
  0,
);

/** Independent per-hero E[HTK] against a stone HP, using the raw prop table — never calls farm-rate. */
function handExpectedHtk(stoneHp: number, avgHit: number): number {
  return WIKI_PROPS.reduce(
    (sum, prop) => sum + (prop.weight / propWeightTotal) * hitsToKill(avgHit, propHp(stoneHp, prop.hpMult)),
    0,
  );
}

type HandRow = {
  heroesOnField: number;
  concurrencyScale: number;
  fortunaAura: number;
  propsPerSec: number;
  propsPerHour: number;
  expectedHtk: number;
  goldPerHour: number;
  chestsPerHour: number;
  xpPerHour: number;
  clearSecs: number;
  cyclesPerHour: number;
  bossPerSec: number;
};

/**
 * The House recovery-slot ceiling, hand-written independently of `allocateHouseSlots`: rank by
 * value density (unconstrained prop rate per slot-second demanded), serve each hero up to its own
 * duty cycle, stop when the slot budget runs out. Returns one activity factor per hero, in
 * `heroFacts` order.
 *
 * The 5-hero fixture is genuinely overcommitted (≈4.1 slots demanded against 3), so this is NOT
 * a no-op on either row below — dropping it produces visibly higher rates, which is the whole
 * point of the fix under test.
 */
function handAllocateHouse(terms: readonly number[], houseSlots: number): number[] {
  const demand = heroFacts.map((hero: HeroFarmFacts) => Math.min(1, Math.max(0, 1 - hero.uptime)));
  const order = heroFacts
    .map((_hero, index) => index)
    .filter((index) => demand[index] > 0)
    .sort((left, right) => terms[right] / demand[right] - terms[left] / demand[left] || left - right);

  const activity: number[] = heroFacts.map((_hero, index) => (demand[index] > 0 ? 0 : 1));
  let budget = houseSlots;
  for (const index of order) {
    if (budget <= 0) break;
    const take = Math.min(1, budget / demand[index]);
    activity[index] = take;
    budget -= demand[index] * take;
  }
  return activity;
}

/**
 * The FIELD-QUEUE scale, hand-written independently of `fieldQueueOutcome` in farm-rate.ts.
 *
 * The game admits heroes FIFO by who finished resting first, which is identity-blind, so the squad
 * keeps the share of its wanted field time the slots can actually serve: `E[min(c, X)] / E[X]`
 * over the Poisson-binomial `X`. Demand is solved rather than assumed — a benched hero does not
 * drain, so its cycle stretches and its demand exceeds its duty cycle. Writing
 * `phi = u / (1 - u)`, a common admission share `s` gives `demand = phi / (phi + s)`, which is
 * exactly `u` when `s = 1`.
 *
 * Written as a plain loop over an explicit pmf rather than mirroring the production structure, so
 * a shared bug in the convolution would not cancel out on both sides.
 */
function handFieldQueueScale(onField: readonly number[], fieldSlots: number): number {
  const count = onField.length;
  if (count === 0 || !Number.isFinite(fieldSlots) || fieldSlots >= count) return 1;

  const pmfOf = (demand: readonly number[]): number[] => {
    let pmf = [1];
    for (const p of demand) {
      const next = new Array<number>(pmf.length + 1).fill(0);
      pmf.forEach((mass, k) => {
        next[k] += mass * (1 - p);
        next[k + 1] += mass * p;
      });
      pmf = next;
    }
    return pmf;
  };
  const servedOver = (demand: readonly number[]): { wanted: number; served: number } => {
    const pmf = pmfOf(demand);
    const wanted = demand.reduce((sum, p) => sum + p, 0);
    const served = pmf.reduce((sum, mass, k) => sum + mass * Math.min(fieldSlots, k), 0);
    return { wanted, served };
  };

  const phi = onField.map((u) => (u >= 1 ? Infinity : u <= 0 ? 0 : u / (1 - u)));
  let demand = onField.slice();
  for (let round = 0; round < 200; round++) {
    const { wanted, served } = servedOver(demand);
    const share = wanted > 0 ? served / wanted : 1;
    const next = phi.map((p) => (p === Infinity ? 1 : p <= 0 ? 0 : p / (p + share)));
    const delta = Math.max(...next.map((v, i) => Math.abs(v - demand[i])));
    demand = next;
    if (delta < 1e-15) break;
  }
  const { wanted, served } = servedOver(demand);
  return wanted > 0 ? served / wanted : 1;
}

/** The whole squad reduction, hand-written independently of buildRow in farm-rate.ts. */
function handComputeRow(stoneHp: number, mitig: number, goldComum: number, phase: number, gate: boolean, ato: number): HandRow {
  const unconstrained = heroFacts.map((hero: HeroFarmFacts) => {
    const mitF = mitigationFactor(mitig, hero.penetrationPct);
    const avgHit = hero.avgHitBase * mitF;
    const eHtk = handExpectedHtk(stoneHp, avgHit);
    const bossHtk = hitsToKill(avgHit, propHp(stoneHp, BOSS_HP_MULT_WIKI));
    const hps = hero.plantsPerSec * hero.blocksPerBomb * EFF_IA;
    return { hero, avgHit, eHtk, term: (hps * hero.uptime) / eHtk, bossTerm: (hps * hero.uptime) / bossHtk };
  });

  const activity = handAllocateHouse(
    unconstrained.map((x) => x.term),
    squad.houseSlots,
  );
  const perHero = unconstrained.map((x, i) => ({
    ...x,
    term: x.term * activity[i],
    bossTerm: x.bossTerm * activity[i],
    onField: x.hero.uptime * activity[i],
  }));

  const shareDenom = perHero.reduce((sum, x) => sum + x.term, 0);
  const bossRateSum = perHero.reduce((sum, x) => sum + x.bossTerm, 0);
  const heroesOnField = perHero.reduce((sum, x) => sum + x.onField, 0);
  // House-ALLOCATED basis, not the unconstrained one — same `onField` term `heroesOnField` sums.
  const fortunaAura = Math.min(
    FORTUNA_AURA_CAP,
    perHero.reduce((sum, x) => sum + x.onField * LOOT_ABILITY_VALUES.fortuna.perLevel * x.hero.fortunaLevel, 0),
  );
  // The FIELD QUEUE, applied after the House ceiling — to the heroes the House can keep fed.
  const concurrencyScale = handFieldQueueScale(
    perHero.map((x) => x.onField),
    squad.fieldSlots,
  );
  const propsPerSec = concurrencyScale * shareDenom;
  const bossPerSec = concurrencyScale * bossRateSum;

  const expectedHtk = perHero.reduce((sum, x) => {
    const share = shareDenom > 0 ? x.term / shareDenom : 0;
    return sum + share * x.eHtk;
  }, 0);

  const veiaOuroPerLevel = LOOT_ABILITY_VALUES.veia_ouro.perLevel;
  const goldSelfMix = perHero.reduce((sum, x) => {
    const share = shareDenom > 0 ? x.term / shareDenom : 0;
    const goldSelf = 1 + veiaOuroPerLevel * x.hero.veiaOuroLevel;
    return sum + share * goldSelf;
  }, 0);

  const propCount = propCountForAto(ato);
  const clearSecs = propCount / propsPerSec + (gate ? 1 / bossPerSec : 0);
  const cyclesPerHour = Number.isFinite(clearSecs) && clearSecs > 0 ? 3600 / clearSecs : 0;
  // The boss is part of a gate cycle and drops nothing, so the hourly prop rate follows the
  // cycle, not the raw prop rate. Non-gate keeps the plain expression bit-for-bit.
  const propsPerHour = gate ? cyclesPerHour * propCount : 3600 * propsPerSec;

  const eGold = goldComum * goldShareFactor;
  const goldMult = squad.teamCoinMult * (1 + fortunaAura) * 1; // bonus = 1 ('off')
  const goldPerHour = propsPerHour * eGold * goldMult * goldSelfMix;

  const sorteMult = 1 + squad.sorteFraction;
  const chestsPerHour = propsPerHour * DROP_RATES.chest * sorteMult * 1;
  const xpPerHour = propsPerHour * xpPerProp(phase) * squad.xpMult * 1;

  return {
    heroesOnField,
    concurrencyScale,
    fortunaAura,
    propsPerSec,
    propsPerHour,
    expectedHtk,
    goldPerHour,
    chestsPerHour,
    xpPerHour,
    clearSecs,
    cyclesPerHour,
    bossPerSec,
  };
}

describe('phase 42 — non-gate hand-computed values (spec.md P1-2 AC-1)', () => {
  const line = wikiPhaseLine(42)!;

  it('published inputs: hp and mitig match spec.md exactly; ato/gate/propCount as stated', () => {
    expect(line.hp).toBe(2475);
    expect(line.mitig).toBeCloseTo(0.04353923205342237, 15);
    expect(line.ato).toBe(1);
    expect(line.gate).toBe(false);
    expect(propCountForAto(line.ato)).toBe(50);
  });

  const hand = handComputeRow(line.hp, line.mitig, line.goldComum, 42, false, line.ato);
  const row = computeFarmRateRow(42, squad)!;

  it('heroesOnField matches the hand-derived greedy House allocation, and is strictly below Σ uptime (the House is overcommitted here)', () => {
    expect(row.heroesOnField).toBeCloseTo(hand.heroesOnField, 12);
    expect(row.concurrencyScale).toBeCloseTo(hand.concurrencyScale, 12);
    expect(squad.houseSlotDemand).toBeGreaterThan(squad.houseSlots);
    expect(row.heroesOnField).toBeLessThan(squad.uptimeSum);
  });

  it('fortunaAura matches the hand-derived House-allocated basis (0 here — the fixture carries no Fortuna)', () => {
    expect(row.fortunaAura).toBe(hand.fortunaAura);
    expect(row.fortunaAura).toBe(0);
  });

  it('expectedHtk matches the hand-derived spawn-weighted E[HTK]', () => {
    expect(row.expectedHtk).toBeCloseTo(hand.expectedHtk, 6);
    expect(Math.abs(row.expectedHtk - hand.expectedHtk) / hand.expectedHtk).toBeLessThan(TOL);
  });

  it('propsPerHour matches the hand-derived squad throughput', () => {
    expect(Math.abs(row.propsPerHour - hand.propsPerHour) / hand.propsPerHour).toBeLessThan(TOL);
  });

  it('goldPerHour matches team_coin × fortuna aura × veia_ouro-share × goldComum × gold-share-factor', () => {
    expect(Math.abs(row.goldPerHour - hand.goldPerHour) / hand.goldPerHour).toBeLessThan(TOL);
  });

  it('chestsPerHour matches propsPerHour × DROP_RATES.chest × (1 + Sorte)', () => {
    expect(Math.abs(row.chestsPerHour - hand.chestsPerHour) / hand.chestsPerHour).toBeLessThan(TOL);
  });

  it('keysPerHour (non-gate gain) matches propsPerHour × DROP_RATES.key × (1 + Sorte)', () => {
    const handKeys = hand.propsPerHour * DROP_RATES.key * (1 + squad.sorteFraction);
    expect(Math.abs(row.keysPerHour - handKeys) / handKeys).toBeLessThan(TOL);
    expect(row.keysPerHour).toBeGreaterThanOrEqual(0);
  });

  it('xpPerHour matches propsPerHour × xpPerProp(42) × squad.xpMult (issue #127)', () => {
    expect(Math.abs(row.xpPerHour - hand.xpPerHour) / hand.xpPerHour).toBeLessThan(TOL);
    // Sanity: the fixture's own xp_mult really is non-identity, so this assertion could not pass
    // by accident if buildRow silently dropped the term (as it did before issue #127's fix).
    expect(squad.xpMult).not.toBe(1);
  });

  it('clearSecs and cyclesPerHour match propCount / propsPerSec (no gate boss term)', () => {
    expect(Math.abs(row.clearSecs - hand.clearSecs) / hand.clearSecs).toBeLessThan(TOL);
    expect(Math.abs(row.cyclesPerHour - hand.cyclesPerHour) / hand.cyclesPerHour).toBeLessThan(TOL);
  });
});

describe('phase 10 — gate hand-computed values (spec.md P1-2 AC-2)', () => {
  const line = wikiPhaseLine(10)!;

  it('published inputs: hp and mitig match spec.md exactly; ato/gate/timer as stated', () => {
    expect(line.hp).toBe(122);
    expect(line.mitig).toBeCloseTo(0.01736227045075125, 15);
    expect(line.ato).toBe(1);
    expect(line.gate).toBe(true);
    expect(GATE_SECS_POR_ATO[line.ato - 1]).toBe(600);
  });

  const hand = handComputeRow(line.hp, line.mitig, line.goldComum, 10, true, line.ato);
  const row = computeFarmRateRow(10, squad)!;

  it('expectedHtk, propsPerHour, goldPerHour, chestsPerHour, xpPerHour match the hand-derived values', () => {
    expect(Math.abs(row.expectedHtk - hand.expectedHtk) / hand.expectedHtk).toBeLessThan(TOL);
    expect(Math.abs(row.propsPerHour - hand.propsPerHour) / hand.propsPerHour).toBeLessThan(TOL);
    expect(Math.abs(row.goldPerHour - hand.goldPerHour) / hand.goldPerHour).toBeLessThan(TOL);
    expect(Math.abs(row.chestsPerHour - hand.chestsPerHour) / hand.chestsPerHour).toBeLessThan(TOL);
    expect(Math.abs(row.xpPerHour - hand.xpPerHour) / hand.xpPerHour).toBeLessThan(TOL);
  });

  it('cyclesPerHour includes the boss term (propCount/propsPerSec + 1/bossPerSec)', () => {
    expect(Math.abs(row.clearSecs - hand.clearSecs) / hand.clearSecs).toBeLessThan(TOL);
    expect(Math.abs(row.cyclesPerHour - hand.cyclesPerHour) / hand.cyclesPerHour).toBeLessThan(TOL);
  });

  it('gemsPerHour and timePiecesPerHour (gate-only) match propsPerHour × their DROP_RATES × (1 + Sorte)', () => {
    const sorteMult = 1 + squad.sorteFraction;
    const handGems = hand.propsPerHour * DROP_RATES.gem * sorteMult;
    const handTime = hand.propsPerHour * DROP_RATES.time * sorteMult;
    expect(Math.abs(row.gemsPerHour - handGems) / handGems).toBeLessThan(TOL);
    expect(Math.abs(row.timePiecesPerHour - handTime) / handTime).toBeLessThan(TOL);
  });

  it('stoneChestsPerHour (gate-only) matches propsPerHour × DROP_RATES.stone × (1 + Sorte)', () => {
    const sorteMult = 1 + squad.sorteFraction;
    const handStone = hand.propsPerHour * DROP_RATES.stone * sorteMult;
    expect(Math.abs(row.stoneChestsPerHour - handStone) / handStone).toBeLessThan(TOL);
    // It shared gemsPerHour's base rate until the 2026-08-23 patch raised the stone chest
    // tenfold (issue #127's original claim). Same props/luck terms, its own published rate.
    expect(row.stoneChestsPerHour).toBeCloseTo(row.gemsPerHour * (DROP_RATES.stone / DROP_RATES.gem), 12);
  });

  it('keysPerHour is negative and equals -(cyclesPerHour × KEY_GATE_COST)', () => {
    expect(row.keysPerHour).toBeLessThan(0);
    const handKeys = -(hand.cyclesPerHour * KEY_GATE_COST);
    expect(Math.abs(row.keysPerHour - handKeys) / Math.abs(handKeys)).toBeLessThan(TOL);
  });

  it('the boss term uses propHp(hp, BOSS_HP_MULT_WIKI) = 10× stone HP', () => {
    expect(BOSS_HP_MULT_WIKI).toBe(10);
    expect(propHp(line.hp, BOSS_HP_MULT_WIKI)).toBe(line.hp * 10);
  });

  it('the boss pays ZERO loot of its own, but its seconds still cost every hourly rate', () => {
    // The same row with the boss term removed (a props-only clear, as on a non-gate row).
    const propsOnlyHand = handComputeRow(line.hp, line.mitig, line.goldComum, 10, false, line.ato);
    expect(propsOnlyHand.clearSecs).toBeLessThan(hand.clearSecs);

    // PER CYCLE the boss changes nothing: it drops no props, so it pays no gold, chest or XP.
    const perCycle = (r: typeof hand, rate: number) => rate / (3600 / r.clearSecs);
    expect(perCycle(hand, hand.propsPerHour)).toBeCloseTo(perCycle(propsOnlyHand, propsOnlyHand.propsPerHour), 9);
    expect(perCycle(hand, hand.goldPerHour)).toBeCloseTo(perCycle(propsOnlyHand, propsOnlyHand.goldPerHour), 6);
    expect(perCycle(hand, hand.xpPerHour)).toBeCloseTo(perCycle(propsOnlyHand, propsOnlyHand.xpPerHour), 6);

    // PER HOUR everything is lower, by exactly the boss's share of the cycle — fewer cycles fit.
    const cycleRatio = propsOnlyHand.clearSecs / hand.clearSecs;
    expect(cycleRatio).toBeLessThan(1);
    expect(hand.propsPerHour / propsOnlyHand.propsPerHour).toBeCloseTo(cycleRatio, 12);
    expect(hand.goldPerHour / propsOnlyHand.goldPerHour).toBeCloseTo(cycleRatio, 12);
    expect(hand.chestsPerHour / propsOnlyHand.chestsPerHour).toBeCloseTo(cycleRatio, 12);
    expect(hand.xpPerHour / propsOnlyHand.xpPerHour).toBeCloseTo(cycleRatio, 12);
  });
});

describe('gold-share factor — independent cross-check against the raw prop table (design.md §2.2)', () => {
  it('Σ share × goldRarityMult, derived from the live WIKI_PROPS table, is what both hand rows use', () => {
    // NOTE: the design's illustrative figure for this factor was 1.545 — that predates the 2026-08-14
    // wiki re-pull (same staleness as the goldComum values noted at the top of this file). The
    // live committed WIKI_PROPS table yields 1.57; this assertion pins that live value so a
    // future prop-table change is caught here rather than silently absorbed into a gold figure.
    expect(goldShareFactor).toBeCloseTo(1.57, 9);
  });
});
