/**
 * Multiplier isolation.
 *
 * Seven cases, each a single-variable delta against a shared baseline, each asserting both the
 * column that must move AND `toBe`-level equality on the columns that must not. Proves the two
 * do-not-"fix" asymmetries from `design.md` §4.2/§4.4: Sorte moves chest/key/gem/time and never
 * gold/xp; the gold chain (team_coin/fortuna/veia_ouro) moves gold and never chest/key/gem/xp.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateRow,
  FORTUNA_AURA_CAP,
  type HeroFarmFacts,
  type SquadFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { wikiPhaseLine, WIKI_PROPS, LOOT_ABILITY_VALUES, DROP_RATES } from '@bombfarm/domain/phase-wiki';
import { hitsToKill, propHp } from '@bombfarm/domain/phases';
import { mitigationFactor, EFF_IA } from '@bombfarm/domain/model';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

// --- Local, independent re-derivation of one hero's prop-destruction share at a phase ----------
// Used only to hand-verify the veia_ouro delta. Never imported from farm-rate.ts.
const PROP_WEIGHT_TOTAL = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);
function handEHtk(stoneHp: number, avgHit: number): number {
  return WIKI_PROPS.reduce(
    (sum, prop) => sum + (prop.weight / PROP_WEIGHT_TOTAL) * hitsToKill(avgHit, propHp(stoneHp, prop.hpMult)),
    0,
  );
}
function heroShare(heroFacts: readonly HeroFarmFacts[], targetId: string, line: { hp: number; mitig: number }): number {
  const terms = heroFacts.map((hero) => {
    const avgHit = hero.avgHitBase * mitigationFactor(line.mitig, hero.penetrationPct);
    const eHtk = handEHtk(line.hp, avgHit);
    const hps = hero.plantsPerSec * hero.blocksPerBomb * EFF_IA;
    return { id: hero.heroId, term: (hps * hero.uptime) / eHtk };
  });
  const denom = terms.reduce((sum, t) => sum + t.term, 0);
  const targetTerm = terms.find((t) => t.id === targetId)!.term;
  return denom > 0 ? targetTerm / denom : 0;
}

/**
 * An account whose House recovers every hero in parallel and whose field fits everyone.
 *
 * The multiplier cases below are single-variable deltas on the LOOT chain; with the fixture's
 * real 3-slot House the greedy recovery-slot allocation is active (the 5-hero roster demands
 * ~4.1 slots), which reshuffles per-hero SHARES and would confound "veia_ouro pays by share"
 * with "the House rationed this hero". Both ceilings are lifted so the only thing moving in each
 * case is the multiplier under test. The ceilings themselves are proved in
 * `farm-rate-concurrency.test.ts`, not here.
 */
const UNCONSTRAINED: AccountShared = { ...account, slots: 1000, fieldSlots: 1000 };

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
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

describe('Sorte multiplies chest/key/gem/time, never gold/xp', () => {
  it('raising tree.luckFlatPct scales the four drop rates by (1+Sorte\')/(1+Sorte); gold/xp byte-identical', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const baseSquad = computeSquadFarmFacts(heroFacts, account);
    const raisedAccount: AccountShared = {
      ...account,
      tree: { ...account.tree, luckFlatPct: (account.tree.luckFlatPct ?? 0) + 10 },
    };
    const raisedSquad = computeSquadFarmFacts(heroFacts, raisedAccount);
    expect(raisedSquad.sorteFraction).toBeGreaterThan(baseSquad.sorteFraction);

    const ratio = (1 + raisedSquad.sorteFraction) / (1 + baseSquad.sorteFraction);

    const baseNonGate = computeFarmRateRow(42, baseSquad)!;
    const raisedNonGate = computeFarmRateRow(42, raisedSquad)!;
    expect(raisedNonGate.chestsPerHour / baseNonGate.chestsPerHour).toBeCloseTo(ratio, 9);
    expect(raisedNonGate.keysPerHour / baseNonGate.keysPerHour).toBeCloseTo(ratio, 9);
    expect(raisedNonGate.goldPerHour).toBe(baseNonGate.goldPerHour);
    expect(raisedNonGate.xpPerHour).toBe(baseNonGate.xpPerHour);

    const baseGate = computeFarmRateRow(10, baseSquad)!;
    const raisedGate = computeFarmRateRow(10, raisedSquad)!;
    expect(raisedGate.gemsPerHour / baseGate.gemsPerHour).toBeCloseTo(ratio, 9);
    expect(raisedGate.timePiecesPerHour / baseGate.timePiecesPerHour).toBeCloseTo(ratio, 9);
    expect(raisedGate.goldPerHour).toBe(baseGate.goldPerHour);
    expect(raisedGate.xpPerHour).toBe(baseGate.xpPerHour);
  });

  it('raising one hero\'s luck (via birth.luck) has the same shape', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const luckyJon: HeroRecord = { ...jon, birth: { ...jon.birth!, luck: jon.birth!.luck + 50 } };
    const heroesRaised = heroes.map((h) => (h.id === jon.id ? luckyJon : h));

    const baseFacts = computeHeroFarmFacts({ heroes, account });
    const raisedFacts = computeHeroFarmFacts({ heroes: heroesRaised, account });
    const baseSquad = computeSquadFarmFacts(baseFacts, account);
    const raisedSquad = computeSquadFarmFacts(raisedFacts, account);
    expect(raisedSquad.sorteFraction).toBeGreaterThan(baseSquad.sorteFraction);

    const ratio = (1 + raisedSquad.sorteFraction) / (1 + baseSquad.sorteFraction);
    const baseRow = computeFarmRateRow(42, baseSquad)!;
    const raisedRow = computeFarmRateRow(42, raisedSquad)!;
    expect(raisedRow.chestsPerHour / baseRow.chestsPerHour).toBeCloseTo(ratio, 9);
    // birth.luck touches no other stat — avgHitBase/propsPerHour are unaffected, so gold/xp
    // are exactly, not just approximately, unchanged.
    expect(raisedRow.goldPerHour).toBe(baseRow.goldPerHour);
    expect(raisedRow.xpPerHour).toBe(baseRow.xpPerHour);
  });
});

describe('Gold tracks team_coin / fortuna / veia_ouro, never Sorte', () => {
  it('raising tree.teamCoinPct scales goldPerHour by the teamCoinMult ratio; drops and xp byte-identical', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const baseSquad = computeSquadFarmFacts(heroFacts, account);
    const raisedAccount: AccountShared = {
      ...account,
      tree: { ...account.tree, teamCoinPct: (account.tree.teamCoinPct ?? 0) + 20 },
    };
    const raisedSquad = computeSquadFarmFacts(heroFacts, raisedAccount);

    const baseRow = computeFarmRateRow(42, baseSquad)!;
    const raisedRow = computeFarmRateRow(42, raisedSquad)!;
    const ratio = raisedSquad.teamCoinMult / baseSquad.teamCoinMult;
    expect(raisedRow.goldPerHour / baseRow.goldPerHour).toBeCloseTo(ratio, 9);

    expect(raisedRow.chestsPerHour).toBe(baseRow.chestsPerHour);
    expect(raisedRow.keysPerHour).toBe(baseRow.keysPerHour);
    expect(raisedRow.xpPerHour).toBe(baseRow.xpPerHour);
  });

  it("raising one hero's veia_ouro level raises goldPerHour by that hero's share × 0.02 × Δlevel — not the full roster's worth; drops/xp byte-identical", () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const delta = 10;
    const boostedJon = withAbilityLevels(jon, { veia_ouro: delta });
    const heroesBoosted = heroes.map((h) => (h.id === jon.id ? boostedJon : h));

    const baseFacts = computeHeroFarmFacts({ heroes, account });
    const boostedFacts = computeHeroFarmFacts({ heroes: heroesBoosted, account });
    // UNCONSTRAINED: `heroShare` below re-derives shares from the UNTHROTTLED per-hero terms, so
    // the House allocation has to be inert for it to be the right hand-derivation.
    const baseSquad = computeSquadFarmFacts(baseFacts, UNCONSTRAINED);
    const boostedSquad = computeSquadFarmFacts(boostedFacts, UNCONSTRAINED);

    const baseRow = computeFarmRateRow(42, baseSquad)!;
    const boostedRow = computeFarmRateRow(42, boostedSquad)!;

    const line = wikiPhaseLine(42)!;
    const share = heroShare(baseFacts, jon.id, line);
    // The fixture carries no veia_ouro anywhere (design.md §2.5), so goldSelfMix_base === 1
    // exactly (Σ share_h × 1 = Σ share_h = 1) — baseRow.goldPerHour already IS
    // propsPerHour × E_gold × goldMult, so the delta reduces to this one clean expression.
    const expectedGold = baseRow.goldPerHour * (1 + share * LOOT_ABILITY_VALUES.veia_ouro.perLevel * delta);
    expect(boostedRow.goldPerHour).toBeCloseTo(expectedGold, 6);

    // Distinguishes "this hero's share" from "the full roster's worth" (share < 1 on a 5-hero squad).
    const fullRosterGold = baseRow.goldPerHour * (1 + LOOT_ABILITY_VALUES.veia_ouro.perLevel * delta);
    expect(boostedRow.goldPerHour).toBeLessThan(fullRosterGold);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);

    expect(boostedRow.propsPerHour).toBe(baseRow.propsPerHour);
    expect(boostedRow.chestsPerHour).toBe(baseRow.chestsPerHour);
    expect(boostedRow.keysPerHour).toBe(baseRow.keysPerHour);
    expect(boostedRow.xpPerHour).toBe(baseRow.xpPerHour);
  });

  it('five heroes maxed on fortuna (full uptime) hit FORTUNA_AURA_CAP exactly (0.10); a sixth maxed hero leaves goldPerHour byte-identical', () => {
    // Both ceilings lifted, for the same reason: with the fixture's own 3 field slots, ADDING a
    // 6th hero's uptime would also move `row.concurrencyScale` (a real, separate effect — more
    // bodies competing for the same field slots), which would confound the "cap binds" claim
    // with a "field is more crowded" effect. Un-crowding removes that confound.
    const uncrowdedAccount: AccountShared = UNCONSTRAINED;

    const fiveMaxed: HeroFarmFacts[] = Array.from({ length: 5 }, (_, i) =>
      syntheticHero({ heroId: `maxed-${i}`, fortunaLevel: 20, uptime: 1 }),
    );
    const squadFive: SquadFarmFacts = computeSquadFarmFacts(fiveMaxed, uncrowdedAccount);
    const rowFive = computeFarmRateRow(42, squadFive)!;
    expect(rowFive.concurrencyScale).toBe(1);
    expect(rowFive.fortunaAura).toBe(FORTUNA_AURA_CAP);
    expect(rowFive.fortunaAura).toBe(0.1);

    // The sixth hero is fully degenerate for throughput (avgHitBase 0) so it contributes ZERO
    // to propsPerHour/goldSelfMix — isolating the assertion to "the cap does not move further".
    const sixMaxed: HeroFarmFacts[] = [
      ...fiveMaxed,
      syntheticHero({ heroId: 'maxed-5', fortunaLevel: 20, uptime: 1, avgHitBase: 0, degenerate: true }),
    ];
    const squadSix: SquadFarmFacts = computeSquadFarmFacts(sixMaxed, uncrowdedAccount);
    const rowSix = computeFarmRateRow(42, squadSix)!;
    expect(rowSix.concurrencyScale).toBe(1);
    expect(rowSix.fortunaAura).toBe(FORTUNA_AURA_CAP);

    expect(rowSix.goldPerHour).toBe(rowFive.goldPerHour);
    expect(rowSix.propsPerHour).toBe(rowFive.propsPerHour);
  });

  it('fortuna below the cap: fortunaAura === Σ uptime_h × 0.005 × level_h exactly (unnormalized sum) when the House does not throttle', () => {
    const belowCap: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'a', fortunaLevel: 5, uptime: 0.5 }),
      syntheticHero({ heroId: 'b', fortunaLevel: 3, uptime: 0.2 }),
    ];
    // The fixture's real House (3 slots) is not binding for this pair's 0.5+0.8 = 1.3 slot demand,
    // so the House-allocated basis and the unconstrained one coincide here — a separate case below
    // (`fortuna basis is the House-ALLOCATED uptime...`) proves they diverge once it does bind.
    const squad = computeSquadFarmFacts(belowCap, account);
    const row = computeFarmRateRow(42, squad)!;
    const expected = 0.5 * LOOT_ABILITY_VALUES.fortuna.perLevel * 5 + 0.2 * LOOT_ABILITY_VALUES.fortuna.perLevel * 3;
    expect(expected).toBeLessThan(FORTUNA_AURA_CAP); // sanity: genuinely below the cap
    expect(row.fortunaAura).toBe(expected);
  });

  it('fortuna basis is the House-ALLOCATED uptime, not the unconstrained one: a hero the House throttles to zero contributes zero aura', () => {
    // Same construction as the concurrency suite's "GREEDY, not uniform" case: equal uptime/demand,
    // wildly different value density, a House budget that can only ever pay for one of them. Both
    // heroes carry the SAME Fortuna level, so any difference between the allocated and
    // unconstrained fortunaAura can only come from which hero the House actually keeps fed.
    const strong = syntheticHero({ heroId: 'strong', uptime: 0.5, plantsPerSec: 5, fortunaLevel: 5 });
    const weak = syntheticHero({ heroId: 'weak', uptime: 0.5, plantsPerSec: 0.01, fortunaLevel: 5 });
    const throttled: AccountShared = { ...account, slots: 0.5, fieldSlots: 1000 };
    const squad = computeSquadFarmFacts([strong, weak], throttled);
    const row = computeFarmRateRow(42, squad)!;

    // Sanity: the House really did throttle one hero to zero (only 0.5 of the 1.0 unconstrained
    // uptime survives).
    expect(row.heroesOnField).toBeCloseTo(0.5, 12);
    expect(row.heroesOnField).toBeLessThan(squad.uptimeSum);

    const perLevel = LOOT_ABILITY_VALUES.fortuna.perLevel;
    const unconstrainedFortuna = (strong.uptime + weak.uptime) * perLevel * 5; // the pre-fix, defect-6 basis
    const allocatedFortuna = strong.uptime * perLevel * 5; // strong wins the whole House budget; weak gets 0

    expect(row.fortunaAura).toBeCloseTo(allocatedFortuna, 12);
    expect(row.fortunaAura).toBeLessThan(unconstrainedFortuna);
    // Exactly half survives: the strongly-favoured hero keeps its full uptime, the other is zeroed.
    expect(row.fortunaAura / unconstrainedFortuna).toBeCloseTo(0.5, 9);
  });
});

describe('Return bonus multiplies gold/XP/drops only — structure is untouched', () => {
  it("'off' → 'on' → 'vip' scales gold, xp and the four drop rates by exactly 1 / 1.4 / 1.8; structural fields are byte-identical", () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);

    const off = computeFarmRateRow(10, squad, { returnBonus: 'off' })!; // gate phase: exercises all 4 drops
    const on = computeFarmRateRow(10, squad, { returnBonus: 'on' })!;
    const vip = computeFarmRateRow(10, squad, { returnBonus: 'vip' })!;

    for (const field of [
      'goldPerHour',
      'chestsPerHour',
      'gemsPerHour',
      'timePiecesPerHour',
      'stoneChestsPerHour',
      'xpPerHour',
    ] as const) {
      expect(on[field] / off[field]).toBeCloseTo(1.4, 9);
      expect(vip[field] / off[field]).toBeCloseTo(1.8, 9);
    }

    for (const field of ['propsPerHour', 'clearSecs', 'cyclesPerHour', 'expectedHtk', 'oneShot', 'infeasible'] as const) {
      expect(on[field]).toBe(off[field]);
      expect(vip[field]).toBe(off[field]);
    }

    // The bonus multiplies gains, not entry costs — a gate row's negative keysPerHour is
    // unchanged across all three modes.
    expect(off.keysPerHour).toBeLessThan(0);
    expect(on.keysPerHour).toBe(off.keysPerHour);
    expect(vip.keysPerHour).toBe(off.keysPerHour);
  });

  it("non-gate keysPerHour (a gain) DOES scale with the bonus, unlike the gate's cost", () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    const off = computeFarmRateRow(42, squad, { returnBonus: 'off' })!;
    const on = computeFarmRateRow(42, squad, { returnBonus: 'on' })!;
    expect(on.keysPerHour / off.keysPerHour).toBeCloseTo(1.4, 9);
  });
});

describe('XP tracks tree.xpMult, never gold/drops (issue #127)', () => {
  it('xpPerHour scales by exactly the xpMult ratio; gold and every drop rate byte-identical', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });

    const oneAccount: AccountShared = { ...account, tree: { ...account.tree, xpMult: 1 } };
    const boostedAccount: AccountShared = { ...account, tree: { ...account.tree, xpMult: 1.56 } };
    const oneSquad = computeSquadFarmFacts(heroFacts, oneAccount);
    const boostedSquad = computeSquadFarmFacts(heroFacts, boostedAccount);
    expect(oneSquad.xpMult).toBe(1);
    expect(boostedSquad.xpMult).toBe(1.56);

    // Non-gate (42) and gate (10) both exercise the same xpPerHour formula — checked on both so
    // the claim is not an artifact of one row's zeroed gate-only fields.
    for (const phase of [42, 10]) {
      const oneRow = computeFarmRateRow(phase, oneSquad)!;
      const boostedRow = computeFarmRateRow(phase, boostedSquad)!;
      expect(boostedRow.xpPerHour / oneRow.xpPerHour).toBeCloseTo(1.56, 12);

      expect(boostedRow.goldPerHour).toBe(oneRow.goldPerHour);
      expect(boostedRow.chestsPerHour).toBe(oneRow.chestsPerHour);
      expect(boostedRow.keysPerHour).toBe(oneRow.keysPerHour);
      expect(boostedRow.gemsPerHour).toBe(oneRow.gemsPerHour);
      expect(boostedRow.timePiecesPerHour).toBe(oneRow.timePiecesPerHour);
      expect(boostedRow.stoneChestsPerHour).toBe(oneRow.stoneChestsPerHour);
    }
  });

  it('an absent tree.xpMult behaves exactly as xpMult: 1 (identity, not zero)', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const { xpMult: _drop, ...treeWithoutXpMult } = account.tree;
    const absentAccount: AccountShared = { ...account, tree: treeWithoutXpMult };
    const explicitOneAccount: AccountShared = { ...account, tree: { ...account.tree, xpMult: 1 } };

    const absentSquad = computeSquadFarmFacts(heroFacts, absentAccount);
    const explicitOneSquad = computeSquadFarmFacts(heroFacts, explicitOneAccount);
    expect(absentSquad.xpMult).toBe(1);

    const absentRow = computeFarmRateRow(42, absentSquad)!;
    const explicitOneRow = computeFarmRateRow(42, explicitOneSquad)!;
    expect(absentRow.xpPerHour).toBe(explicitOneRow.xpPerHour);
    expect(absentRow.xpPerHour).toBeGreaterThan(0);
  });

  it('a non-finite tree.xpMult (NaN) also falls back to 1, not NaN', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const nanAccount: AccountShared = { ...account, tree: { ...account.tree, xpMult: NaN } };
    const squad = computeSquadFarmFacts(heroFacts, nanAccount);
    expect(squad.xpMult).toBe(1);
    expect(Number.isNaN(computeFarmRateRow(42, squad)!.xpPerHour)).toBe(false);
  });
});

describe('stoneChestsPerHour shares gemsPerHour’s gate rule but no longer its rate (issue #127)', () => {
  it('on a gate phase, stoneChestsPerHour is DROP_RATES.stone / DROP_RATES.gem times gemsPerHour', () => {
    // The two rates were equal (0.00005 apiece) until the 2026-08-23 patch raised the stone
    // chest tenfold to 0.0005. The RATIO is asserted rather than the equality, so the two rows
    // stay tied to the same props/luck/bonus terms and only the published rate separates them.
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    const gateRow = computeFarmRateRow(10, squad)!;
    expect(gateRow.gate).toBe(true);
    expect(gateRow.stoneChestsPerHour).toBeCloseTo(
      gateRow.gemsPerHour * (DROP_RATES.stone / DROP_RATES.gem),
      12,
    );
    expect(gateRow.stoneChestsPerHour).toBeGreaterThan(gateRow.gemsPerHour);
  });

  it('on a non-gate phase, stoneChestsPerHour is 0, same as gemsPerHour', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    const nonGateRow = computeFarmRateRow(42, squad)!;
    expect(nonGateRow.gate).toBe(false);
    expect(nonGateRow.stoneChestsPerHour).toBe(0);
    expect(nonGateRow.gemsPerHour).toBe(0);
  });
});
