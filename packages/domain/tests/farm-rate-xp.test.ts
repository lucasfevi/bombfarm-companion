/**
 * XP per prop is `wiki xp × xp_mult × (1 + return + pass + boost) × (1 + p) × (1 + 0.0075 × r)`:
 * `p` the xp rune of the hero that destroyed the prop, `r` the rank of an Aprendiz carrier on the
 * field — the bracket additive, the rune a per-hero factor, Aprendiz a factor on every hero's
 * props, all measured from live traffic. These cases pin that shape on hand-built facts, so they
 * hold for any account rather than for one capture.
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
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

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

describe('Aprendiz multiplies the XP of every prop the field destroys', () => {
  const MEASURED_XP_MULT = 2.3981289;

  function perProp(heroes: readonly HeroFarmFacts[], xpMult: number = XP_MULT): number {
    const priced = row(heroes, xpMult, PASS_ON);
    return (priced.xpPerHour ?? Number.NaN) / priced.propsPerHour;
  }

  it('a rank-20 carrier on phase 171 pays 524 × 2.3981289 × 1.3 × 1.15 per prop', () => {
    expect(perProp([hero('a', { apprenticeRank: 20 })], MEASURED_XP_MULT)).toBeCloseTo(1878.646, 3);
  });

  it('multiplies outside the bracket: rank 20 is exactly ×1.15 under a Return window and a Boost too', () => {
    const options: FarmRateOptions = { returnBonus: 'on', pass: true, boost: { gold: false, xp: true, drop: false } };
    const bare = row([hero('a')], XP_MULT, options);
    const carried = row([hero('a', { apprenticeRank: 20 })], XP_MULT, options);
    expect((carried.xpPerHour ?? Number.NaN) / (bare.xpPerHour ?? Number.NaN)).toBeCloseTo(1.15, 12);
    expect(carried.goldPerHour).toBe(bare.goldPerHour);
  });

  it('a rank-10 carrier gives ×1.075', () => {
    expect(perProp([hero('a', { apprenticeRank: 10 })]) / perProp([hero('a')])).toBeCloseTo(1.075, 12);
  });

  it('two rank-20 carriers give one carrier’s maximum, not the sum', () => {
    const two = perProp([hero('a', { apprenticeRank: 20 }), hero('b', { apprenticeRank: 20 })]);
    const none = perProp([hero('a'), hero('b')]);
    expect(two / none).toBeCloseTo(1.15, 12);
  });

  it('lifts the non-carrier’s share too, unlike a rune that reaches only its own hero’s kills', () => {
    const bare = perProp([hero('a'), hero('b')]);
    expect(perProp([hero('a', { apprenticeRank: 20 }), hero('b')]) / bare).toBeCloseTo(1.15, 12);
    expect(perProp([hero('a', { xpRuneMult: 1.15 }), hero('b')]) / bare).toBeCloseTo(1.075, 9);
  });

  it('a carrier that never stands on the field gives ×1', () => {
    const benched = computeSquadFarmFacts([hero('a'), hero('b', { apprenticeRank: 20, uptime: 0 })], account(XP_MULT));
    expect(benched.apprenticeXpMult).toBe(1);
  });

  it('a carrier on the field half the time is priced at half its aura, as the standing auras are', () => {
    const squad = computeSquadFarmFacts([hero('a', { apprenticeRank: 20, uptime: 0.5 })], account(XP_MULT));
    expect(squad.apprenticeXpMult).toBeCloseTo(1.075, 12);
  });

  it('the row repeats the squad factor', () => {
    expect(row([hero('a', { apprenticeRank: 20 })], XP_MULT, PASS_ON).apprenticeXpMult).toBeCloseTo(1.15, 12);
    expect(row([hero('a')], XP_MULT, PASS_ON).apprenticeXpMult).toBe(1);
  });
});

describe('a hero record carrying Aprendiz reaches the row', () => {
  const { heroes, account: fixtureAccount } = loadFarmRateFixture();
  const accountWithXp = { ...fixtureAccount, tree: { ...fixtureAccount.tree, xpMult: XP_MULT } };
  const [subject, other] = heroes;
  const carrier = withAbilityLevels(other, { aprendiz: 20 });

  it('the hero facts carry the rank, and a hero without it carries none', () => {
    const facts = computeHeroFarmFacts({ heroes: [subject, carrier], account: accountWithXp, enabledHeroIds: [subject.id, carrier.id] });
    expect(facts[1].apprenticeRank).toBe(20);
    expect(facts[0].apprenticeRank).toBeUndefined();
  });

  it('a carrier left out of the pool is benched, and the pool earns ×1', () => {
    const rate = (roster: typeof heroes) =>
      computeFarmRates({ heroes: roster, account: accountWithXp, enabledHeroIds: [subject.id], pass: true }).rows;
    const bareRows = rate([subject, other]);
    const benchedRows = rate([subject, carrier]);
    expect(benchedRows.map((candidate) => candidate.xpPerHour)).toEqual(bareRows.map((candidate) => candidate.xpPerHour));
    expect(benchedRows.every((candidate) => candidate.apprenticeXpMult === 1)).toBe(true);
  });

  it('an enabled carrier lifts every feasible row by its rotation-weighted aura', () => {
    const { squad, rows } = computeFarmRates({
      heroes: [subject, carrier],
      account: accountWithXp,
      enabledHeroIds: [subject.id, carrier.id],
      pass: true,
    });
    const carrierUptime = squad.heroes[1].uptime;
    expect(squad.apprenticeXpMult).toBeCloseTo(1 + 0.15 * carrierUptime, 12);
    const bareRows = computeFarmRates({
      heroes: [subject, other],
      account: accountWithXp,
      enabledHeroIds: [subject.id, other.id],
      pass: true,
    }).rows;
    const compared = bareRows.filter((candidate) => (candidate.xpPerHour ?? 0) > 0);
    expect(compared.length).toBeGreaterThan(0);
    for (const bareRow of compared) {
      const carriedRow = rows[bareRow.phase - 1];
      expect(carriedRow.propsPerHour).toBe(bareRow.propsPerHour);
      expect((carriedRow.xpPerHour ?? Number.NaN) / (bareRow.xpPerHour ?? Number.NaN)).toBeCloseTo(squad.apprenticeXpMult, 9);
    }
  });
});
