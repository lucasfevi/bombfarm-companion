/**
 * PFR item B, T7 (`R-B4`, `R-B7`, `R-B8`, `R-B9`, spec.md P1-2) — hand-computed fixture values.
 *
 * Two blocks: phase 42 (non-gate) and phase 10 (gate), each ato 1 on the 5-hero fixture. Every
 * expectation below is built from PUBLISHED INPUTS ONLY — the wiki line's own fields, the raw
 * `WIKI_PROPS` table, the exported constants, and the fixture's own `HeroFarmFacts` (obtained via
 * `computeHeroFarmFacts`/`computeSquadFarmFacts`, which T5 already proved independently). No
 * expectation here is built by calling `computeFarmRateRow` or `computeFarmRateTable` — only the
 * row under test is.
 *
 * DATA-STALENESS NOTE (spec-precision gap, flagged for the validator): `spec.md` P1-2 AC-1/AC-2
 * cite `goldComum 209.3469387755102` (phase 42) and `goldComum 46.734693877551024` (phase 10),
 * and `design.md` §2.2 cites `Σ share × goldRarityMult = 1.545`. The committed wiki bundle
 * (item A's 2026-08-14 pull, landed on this same branch) carries `goldComum 157` / `35` for
 * those two phases and a live `Σ share × goldRarityMult` of `1.57` — hp and mitig match spec.md
 * exactly, only goldComum/the gold-share factor differ, consistent with the `pfr-wiki-bundle`
 * changeset's own note that "Phase gold is about 25% lower... the committed bundle was simply
 * stale." T7's own instruction is to derive expectations from PUBLISHED (i.e. live) inputs, never
 * from spec.md's now-stale illustrative figures — so every number below is read live off
 * `wikiPhaseLine` / `WIKI_PROPS`, never typed from spec.md's table.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateRow,
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

/** The whole squad reduction, hand-written independently of buildRow in farm-rate.ts. */
function handComputeRow(stoneHp: number, mitig: number, goldComum: number, phase: number, gate: boolean, ato: number): HandRow {
  const perHero = heroFacts.map((hero: HeroFarmFacts) => {
    const mitF = mitigationFactor(mitig, hero.penetrationPct);
    const avgHit = hero.avgHitBase * mitF;
    const eHtk = handExpectedHtk(stoneHp, avgHit);
    const bossHtk = hitsToKill(avgHit, propHp(stoneHp, BOSS_HP_MULT_WIKI));
    const hps = hero.plantsPerSec * hero.blocksPerBomb * EFF_IA;
    const term = (hps * hero.uptime) / eHtk;
    const bossTerm = (hps * hero.uptime) / bossHtk;
    return { hero, avgHit, eHtk, term, bossTerm };
  });

  const shareDenom = perHero.reduce((sum, x) => sum + x.term, 0);
  const bossRateSum = perHero.reduce((sum, x) => sum + x.bossTerm, 0);
  const propsPerSec = squad.concurrencyScale * shareDenom;
  const bossPerSec = squad.concurrencyScale * bossRateSum;
  const propsPerHour = 3600 * propsPerSec;

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

  const eGold = goldComum * goldShareFactor;
  const goldMult = squad.teamCoinMult * (1 + squad.fortunaAura) * 1; // bonus = 1 ('off')
  const goldPerHour = propsPerHour * eGold * goldMult * goldSelfMix;

  const sorteMult = 1 + squad.sorteFraction;
  const chestsPerHour = propsPerHour * DROP_RATES.chest * sorteMult * 1;
  const xpPerHour = propsPerHour * xpPerProp(phase) * 1;

  return { propsPerSec, propsPerHour, expectedHtk, goldPerHour, chestsPerHour, xpPerHour, clearSecs, cyclesPerHour, bossPerSec };
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

  it('xpPerHour matches propsPerHour × xpPerProp(42), no xp_mult term', () => {
    expect(Math.abs(row.xpPerHour - hand.xpPerHour) / hand.xpPerHour).toBeLessThan(TOL);
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

  it('keysPerHour is negative and equals -(cyclesPerHour × KEY_GATE_COST)', () => {
    expect(row.keysPerHour).toBeLessThan(0);
    const handKeys = -(hand.cyclesPerHour * KEY_GATE_COST);
    expect(Math.abs(row.keysPerHour - handKeys) / Math.abs(handKeys)).toBeLessThan(TOL);
  });

  it('the boss term uses propHp(hp, BOSS_HP_MULT_WIKI) = 10× stone HP', () => {
    expect(BOSS_HP_MULT_WIKI).toBe(10);
    expect(propHp(line.hp, BOSS_HP_MULT_WIKI)).toBe(line.hp * 10);
  });

  it('the boss pays ZERO gold/chest/gem/time/xp — only clearSecs/cyclesPerHour/keysPerHour differ from a props-only clear', () => {
    // Recompute clearSecs with the boss term removed (props-only clear, as on a non-gate row).
    const propsOnlyHand = handComputeRow(line.hp, line.mitig, line.goldComum, 10, false, line.ato);
    // Every loot column is identical whether or not the boss term is included in clearSecs —
    // because loot is driven by propsPerHour, which never includes the boss.
    expect(propsOnlyHand.propsPerHour).toBeCloseTo(hand.propsPerHour, 9);
    expect(propsOnlyHand.goldPerHour).toBeCloseTo(hand.goldPerHour, 6);
    expect(propsOnlyHand.chestsPerHour).toBeCloseTo(hand.chestsPerHour, 9);
    expect(propsOnlyHand.xpPerHour).toBeCloseTo(hand.xpPerHour, 6);
    // Only clearSecs (and what derives from it) differs — the boss term genuinely adds seconds.
    expect(propsOnlyHand.clearSecs).toBeLessThan(hand.clearSecs);
  });
});

describe('gold-share factor — independent cross-check against the raw prop table (design.md §2.2)', () => {
  it('Σ share × goldRarityMult, derived from the live WIKI_PROPS table, is what both hand rows use', () => {
    // NOTE: design.md states this factor as 1.545 — that figure predates item A's 2026-08-14
    // wiki re-pull (same staleness as the goldComum values noted at the top of this file). The
    // live committed WIKI_PROPS table yields 1.57; this assertion pins that live value so a
    // future prop-table change is caught here rather than silently absorbed into a gold figure.
    expect(goldShareFactor).toBeCloseTo(1.57, 9);
  });
});
