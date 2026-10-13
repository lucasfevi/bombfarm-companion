/**
 * XP per prop is `wiki xp × xp_mult × (1 + return + pass + boost) × (1 + p)` for the xp rune of
 * the hero that destroyed the prop — the bracket additive, the rune a separate per-hero factor,
 * both measured from live traffic. These cases pin that shape on hand-built facts, so they hold
 * for any account rather than for one capture.
 */
import { describe, expect, it } from 'vitest';
import {
  accountXpPerPropMult,
  computeFarmRateRow,
  computeFarmRates,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  economyMultipliers,
  NO_ECONOMY_BOOST,
  type FarmRateOptions,
  type HeroFarmFacts,
  type SquadFarmAccount,
} from '@bombfarm/domain/farm-rate';
import { FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { PASS_ADDS, xpPerProp } from '@bombfarm/domain/phase-wiki';
import { runeXpMultiplier, type HeroRune } from '@bombfarm/domain/runes';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const PHASE = 171;
const XP_MULT = 2.35;

function hero(id: string, overrides: Partial<HeroFarmFacts> = {}): HeroFarmFacts {
  return {
    heroId: id,
    heroName: id,
    avgHitBase: 1e12,
    penetrationPct: 0,
    fuseSecs: 2,
    fuseFloorSecs: FUSE_FLOOR,
    cdrCapPct: STAT_CAPS.cdr,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 1,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

function account(xpMult: number | undefined): SquadFarmAccount {
  return {
    slots: 1000,
    fieldSlots: 1000,
    tree: {
      danoTotal: 1,
      critChance: 0,
      critDmg: 0,
      speed: 0,
      energy: 0,
      teamCoinPct: 0,
      luckFlatPct: 0,
      ...(xpMult === undefined ? {} : { xpMult }),
    },
  };
}

function row(heroes: readonly HeroFarmFacts[], xpMult: number | undefined, options: FarmRateOptions = {}) {
  const found = computeFarmRateRow(PHASE, computeSquadFarmFacts(heroes, account(xpMult)), options);
  if (!found) throw new Error(`phase ${PHASE} has no wiki row`);
  return found;
}

const PASS_ON: FarmRateOptions = { returnBonus: 'off', pass: true };

describe('the per-prop XP reconciliation, phase 171', () => {
  it('reads the wiki base this case is built on', () => {
    expect(xpPerProp(PHASE)).toBe(524);
  });

  it('Pass on, no return window: 524 × 2.35 × 1.3', () => {
    expect(PASS_ADDS.xp[1]).toBe(0.3);
    const mult = accountXpPerPropMult(XP_MULT, { returnBonus: 'off', pass: true });
    expect(xpPerProp(PHASE) * (mult ?? Number.NaN)).toBeCloseTo(1600.82, 9);
  });

  it('an xp Boost adds inside the same bracket: 524 × 2.35 × 2.3, not × 1.3 × 2', () => {
    const mult = accountXpPerPropMult(XP_MULT, {
      returnBonus: 'off',
      pass: true,
      boost: { gold: false, xp: true, drop: false },
    });
    expect(xpPerProp(PHASE) * (mult ?? Number.NaN)).toBeCloseTo(524 * 2.35 * 2.3, 9);
  });

  it('a Boost reaches only its own axis', () => {
    const bare = economyMultipliers({ returnBonus: 'on', pass: true });
    const goldBoost = economyMultipliers({ returnBonus: 'on', pass: true, boost: { gold: true, xp: false, drop: false } });
    const dropBoost = economyMultipliers({ returnBonus: 'on', pass: true, boost: { gold: false, xp: false, drop: true } });
    expect(goldBoost).toEqual({ ...bare, gold: bare.gold + 1 });
    expect(dropBoost).toEqual({ ...bare, dropAdd: bare.dropAdd + 1 });
    expect(economyMultipliers({ returnBonus: 'on', pass: true, boost: NO_ECONOMY_BOOST })).toEqual(bare);
  });

  it('a row prints the same XP as its props/hr times the per-prop figure', () => {
    const priced = row([hero('a')], XP_MULT, PASS_ON);
    const perProp = xpPerProp(PHASE) * (accountXpPerPropMult(XP_MULT, { returnBonus: 'off', pass: true }) ?? Number.NaN);
    expect(priced.propsPerHour).toBeGreaterThan(0);
    expect(priced.xpPerHour).toBeCloseTo(priced.propsPerHour * perProp, 6);
  });
});

describe('xp_mult on the row', () => {
  it('scales XP/hr exactly and nothing else', () => {
    const one = row([hero('a')], 1, PASS_ON);
    const scaled = row([hero('a')], XP_MULT, PASS_ON);
    expect((scaled.xpPerHour ?? Number.NaN) / (one.xpPerHour ?? Number.NaN)).toBeCloseTo(XP_MULT, 12);
    expect(scaled.goldPerHour).toBe(one.goldPerHour);
    expect(scaled.chestsPerHour).toBe(one.chestsPerHour);
  });

  it('is withheld, not priced at 1, when the account carries none — gold still prices', () => {
    const withheld = row([hero('a')], undefined, PASS_ON);
    expect(withheld.xpPerHour).toBeNull();
    expect(withheld.goldPerHour).toBe(row([hero('a')], XP_MULT, PASS_ON).goldPerHour);
    expect(accountXpPerPropMult(undefined, { returnBonus: 'off', pass: true })).toBeNull();
    expect(accountXpPerPropMult(Number.NaN, { returnBonus: 'off', pass: true })).toBeNull();
  });
});

describe('the xp rune is a multiplier on its own hero share', () => {
  it('a lone hero under a 9% xp rune earns exactly 1.09× the XP, and the same gold', () => {
    const bare = row([hero('a')], XP_MULT, PASS_ON);
    const runed = row([hero('a', { xpRuneMult: 1.09 })], XP_MULT, PASS_ON);
    expect((runed.xpPerHour ?? Number.NaN) / (bare.xpPerHour ?? Number.NaN)).toBeCloseTo(1.09, 12);
    expect(runed.goldPerHour).toBe(bare.goldPerHour);
  });

  it('beside an identical unruned hero it reaches only the half of the props its hero kills', () => {
    const bare = row([hero('a'), hero('b')], XP_MULT, PASS_ON);
    const oneRuned = row([hero('a', { xpRuneMult: 1.09 }), hero('b')], XP_MULT, PASS_ON);
    expect((oneRuned.xpPerHour ?? Number.NaN) / (bare.xpPerHour ?? Number.NaN)).toBeCloseTo(1.045, 9);
  });

  it('multiplies rather than adding into the bracket', () => {
    const runes: HeroRune[] = [{ axis: 'xp', strengthPct: 9, playSecondsLeft: 3600, rarity: 0 }];
    expect(runeXpMultiplier(runes)).toBeCloseTo(1.09, 15);
    expect(runeXpMultiplier([{ axis: 'gold', strengthPct: 9, playSecondsLeft: 3600, rarity: 0 }])).toBe(1);
    expect(runeXpMultiplier([])).toBe(1);
  });
});

describe('a hero record carrying an xp rune reaches the row', () => {
  // A plumbing assertion only — the ratio is independent of how the fixture's sheets price.
  const { heroes, account: fixtureAccount } = loadFarmRateFixture();
  const subject = heroes[0];
  const runed = { ...subject, runes: [{ axis: 'xp' as const, strengthPct: 9, playSecondsLeft: 3600, rarity: 0 }] };
  const accountWithXp = { ...fixtureAccount, tree: { ...fixtureAccount.tree, xpMult: XP_MULT } };

  it('the hero facts carry the rune multiplier, and an unruned hero carries none', () => {
    const [facts] = computeHeroFarmFacts({ heroes: [runed], account: accountWithXp, enabledHeroIds: [runed.id] });
    expect(facts.xpRuneMult).toBeCloseTo(1.09, 15);
    const [bareFacts] = computeHeroFarmFacts({ heroes: [subject], account: accountWithXp, enabledHeroIds: [subject.id] });
    expect(bareFacts.xpRuneMult).toBeUndefined();
  });

  it('a one-hero pool earns 1.09× the XP on every feasible row', () => {
    const rate = (record: typeof subject) =>
      computeFarmRates({ heroes: [record], account: accountWithXp, enabledHeroIds: [record.id], pass: true }).rows;
    const bareRows = rate(subject);
    const runedRows = rate(runed);
    const compared = bareRows.filter((candidate) => (candidate.xpPerHour ?? 0) > 0);
    expect(compared.length).toBeGreaterThan(0);
    for (const bareRow of compared) {
      const runedRow = runedRows[bareRow.phase - 1];
      expect((runedRow.xpPerHour ?? Number.NaN) / (bareRow.xpPerHour ?? Number.NaN)).toBeCloseTo(1.09, 9);
    }
  });
});
