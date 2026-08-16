/**
 * Per-hero and squad farm facts.
 *
 * Every field, every unit, every degenerate branch named in `design.md` §3.2/§3.3/§4.1/§4.2.
 * Exhaustive degenerate/boundary sweeps live in `farm-rate-degenerate.test.ts` (T9); this file
 * proves the formulas themselves, including the luck-peel identity against `peelSheetSources`.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  cycleSecondsForHero,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { peelSheetSources, ABILITY_LEVEL_MAX, type TreeSheetTotals } from '@bombfarm/domain/model';
import { abilityMods } from '@bombfarm/domain/model';
import { emptySheetOther, type SheetOtherPct } from '@bombfarm/domain/gear';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

describe('computeHeroFarmFacts — the base pipeline call (design.md §0 trap #1)', () => {
  it('mitF === 1 on the base call — proves phase=1 + mitigationPct=0 never bakes in phase-1 mitigation', () => {
    for (const hero of heroes) {
      const pipeline = pipelineForHero(hero, account, 1, 0);
      expect(pipeline.mitF).toBe(1);
    }
  });
});

describe('computeHeroFarmFacts — uptime is a fraction (design.md §0 trap #2)', () => {
  it('uptime ∈ (0, 1] and equals pipeline.uptime / 100 for every enabled hero', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    expect(facts).toHaveLength(5);
    for (const fact of facts) {
      const pipeline = pipelineForHero(heroes.find((h) => h.id === fact.heroId)!, account, 1, 0);
      expect(fact.uptime).toBeGreaterThan(0);
      expect(fact.uptime).toBeLessThanOrEqual(1);
      expect(fact.uptime).toBeCloseTo(pipeline.uptime / 100, 12);
    }
  });
});

describe('computeHeroFarmFacts — blocksPerBomb (design.md §0 trap #3)', () => {
  it('blocksPerBomb === 1 + 0.5 × context.blastRange, and === 1.5 for every fixture hero (none carry Explosão Ampla)', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    for (const fact of facts) {
      const pipeline = pipelineForHero(heroes.find((h) => h.id === fact.heroId)!, account, 1, 0);
      expect(fact.blocksPerBomb).toBeCloseTo(1 + 0.5 * pipeline.context.blastRange, 12);
      expect(fact.blocksPerBomb).toBe(1.5);
    }
  });
});

describe('computeHeroFarmFacts — cycleSecs = E[max(fuseSecs, hop/w)] + latency over HOP_DISTRIBUTION', () => {
  it('a normal fixture hero matches cycleSecondsForHero exactly (the fact is the function, not a copy of it)', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const [fact] = computeHeroFarmFacts({ heroes: [jon], account });
    expect(fact.cycleSecs).toBeCloseTo(cycleSecondsForHero(fact.fuseSecs, fact.walkSpeedCells), 12);
  });

  it('a normal fixture hero is mostly walk-bound — its cycle exceeds the pure fuse-bound floor', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const [fact] = computeHeroFarmFacts({ heroes: [jon], account });
    const fuseBoundFloor = cycleSecondsForHero(fact.fuseSecs, 1e9);
    expect(fact.cycleSecs).toBeGreaterThan(fuseBoundFloor);
  });

  it('a speed-boosted copy converges on the fuse-bound floor — every hop but the shortest clears the fuse', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    // design.md §2.5 / tasks.md T5: no fixture hero is naturally fuse-bound at this fixture's
    // speeds — constructed by boosting the birth speed roll well past every walk-bound crossover.
    const fastJon: HeroRecord = { ...jon, birth: { ...jon.birth!, speed: jon.birth!.speed * 50 } };
    const [fact] = computeHeroFarmFacts({ heroes: [fastJon], account });
    expect(fact.cycleSecs).toBeCloseTo(cycleSecondsForHero(fact.fuseSecs, 1e9), 6);
  });

  it('the distribution-averaged cycle is STRICTLY SLOWER than the retired max(fuse, 4.5/w) — the regression this fix repairs', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const [fact] = computeHeroFarmFacts({ heroes: [jon], account });
    const retired = Math.max(fact.fuseSecs, 4.5 / fact.walkSpeedCells);
    expect(fact.cycleSecs).toBeGreaterThan(retired);
    // Measured on the live capture at ~1.3-1.4x for this roster's speeds; pinned loosely so a
    // re-fit of the distribution does not trip it, but tightly enough to catch a collapse back
    // to a mean-first model, which would land at exactly 1.0.
    expect(fact.cycleSecs / retired).toBeGreaterThan(1.2);
    expect(fact.cycleSecs / retired).toBeLessThan(1.6);
  });

  it('w <= 0 (constructed via zero speed) ⇒ cycleSecs Infinity, plantsPerSec 0, degenerate true', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const stillJon: HeroRecord = { ...jon, birth: { ...jon.birth!, speed: 0 } };
    const [fact] = computeHeroFarmFacts({ heroes: [stillJon], account });
    expect(fact.walkSpeedCells).toBe(0);
    expect(fact.cycleSecs).toBe(Infinity);
    expect(fact.plantsPerSec).toBe(0);
    expect(fact.degenerate).toBe(true);
  });
});

describe('computeHeroFarmFacts — heroLuckPct peel identity', () => {
  it('equals peelSheetSources(...).luck hero+gear+ability, to within 1e-9, for every birth-backed fixture hero', () => {
    const treeLuckFlatPct = account.tree.luckFlatPct ?? 0;
    const tree: TreeSheetTotals = {
      danoStatic: account.tree.danoTotal,
      energyPct: account.tree.energy,
      speedPct: account.tree.speed,
      critChancePct: account.tree.critChance,
      critDmgPct: account.tree.critDmg,
      luckFlatPct: treeLuckFlatPct,
    };

    const facts = computeHeroFarmFacts({ heroes, account });
    for (const fact of facts) {
      const hero = heroes.find((h) => h.id === fact.heroId)!;
      expect(hero.birth, `hero "${hero.name}" must be birth-backed for this identity`).toBeDefined();

      const mods = abilityMods(hero.abilities);
      const sheetOther: SheetOtherPct = {
        ...emptySheetOther(),
        critChance: mods.sheetCritChancePctOfBase / 100,
        penetration: mods.sheetPenetrationRaw,
        critDmg: mods.sheetCritDmgPctOfBase,
      };

      const lines = peelSheetSources({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther,
        loadout: hero.loadout,
        pts: hero.pts,
        tree,
      });
      const peeledLuck = lines.luck.hero + lines.luck.gear + lines.luck.ability;

      expect(Math.abs(fact.heroLuckPct - peeledLuck)).toBeLessThanOrEqual(1e-9);
      // The peel's own skillTree line is the tree's flat share, verbatim (design.md §2.1 fact 5).
      expect(lines.luck.skillTree).toBe(treeLuckFlatPct);
    }
  });

  it('heroLuckPct is invariant to account.tree.luckFlatPct (the subtraction cancels exactly — no double count)', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const lowLuckAccount: AccountShared = { ...account, tree: { ...account.tree, luckFlatPct: 1 } };
    const highLuckAccount: AccountShared = { ...account, tree: { ...account.tree, luckFlatPct: 40 } };

    const [lowFact] = computeHeroFarmFacts({ heroes: [jon], account: lowLuckAccount });
    const [highFact] = computeHeroFarmFacts({ heroes: [jon], account: highLuckAccount });

    expect(highFact.heroLuckPct).toBeCloseTo(lowFact.heroLuckPct, 9);
  });
});

describe('computeSquadFarmFacts — sorteFraction tracks Δtree.luckFlatPct exactly', () => {
  it('Δtree.luckFlatPct = x ⇒ ΔsorteFraction = x / 100 exactly, for a fixed heroFacts array', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const baseAccount: AccountShared = { ...account, tree: { ...account.tree, luckFlatPct: 5 } };
    const raisedAccount: AccountShared = { ...account, tree: { ...account.tree, luckFlatPct: 5 + 12.5 } };

    const baseSquad = computeSquadFarmFacts(heroFacts, baseAccount);
    const raisedSquad = computeSquadFarmFacts(heroFacts, raisedAccount);

    expect(raisedSquad.sorteFraction - baseSquad.sorteFraction).toBeCloseTo(12.5 / 100, 12);
  });
});

describe('computeHeroFarmFacts — ability level clamp', () => {
  it('veia_ouro and fortuna levels above ABILITY_LEVEL_MAX clamp to ABILITY_LEVEL_MAX', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const overLeveled = withAbilityLevels(jon, { veia_ouro: 999, fortuna: -5 });
    const [fact] = computeHeroFarmFacts({ heroes: [overLeveled], account });
    expect(fact.veiaOuroLevel).toBe(ABILITY_LEVEL_MAX);
    expect(fact.fortunaLevel).toBe(0);
  });
});

describe('computeHeroFarmFacts — enabled pool semantics', () => {
  it('default pool (omitted enabledHeroIds) is every fixture hero — battleAllowed !== false', () => {
    expect(computeHeroFarmFacts({ heroes, account })).toHaveLength(5);
  });

  it('explicit [] is the empty pool, not "use the default"', () => {
    expect(computeHeroFarmFacts({ heroes, account, enabledHeroIds: [] })).toHaveLength(0);
  });

  it('an id not present in heroes[] is ignored silently — pool is the intersection', () => {
    const jonId = heroes.find((h) => h.name === 'Jon')!.id;
    const facts = computeHeroFarmFacts({ heroes, account, enabledHeroIds: [jonId, 'no-such-hero'] });
    expect(facts).toHaveLength(1);
    expect(facts[0].heroId).toBe(jonId);
  });

  it('an enabledHeroIds list of only unknown ids yields the empty pool', () => {
    expect(computeHeroFarmFacts({ heroes, account, enabledHeroIds: ['no-such-hero'] })).toHaveLength(0);
  });
});

describe('computeSquadFarmFacts — the two slot counts are read from two different keys', () => {
  it('houseSlots reads account.slots (casa.slots) and fieldSlots reads account.fieldSlots (skills.field_slots) — both 3 on this fixture, which is why the confusion was invisible here', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    expect(squad.houseSlots).toBe(3);
    expect(squad.fieldSlots).toBe(3);
  });

  it('the two are genuinely independent — moving one does not move the other', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const split = computeSquadFarmFacts(heroFacts, { ...account, slots: 3, fieldSlots: 6 });
    expect(split.houseSlots).toBe(3);
    expect(split.fieldSlots).toBe(6);
  });

  it('fieldSlots falls back to account.slots for a record stored before the split, then to DEFAULT_CASA_SLOTS — not 0, not Infinity', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const legacy: AccountShared = { ...account, fieldSlots: null, slots: 4 };
    expect(computeSquadFarmFacts(heroFacts, legacy).fieldSlots).toBe(4);

    const noSlotsAccount: AccountShared = { ...account, slots: undefined, fieldSlots: null };
    const squad = computeSquadFarmFacts(heroFacts, noSlotsAccount);
    expect(squad.fieldSlots).toBe(DEFAULT_CASA_SLOTS);
    expect(squad.houseSlots).toBe(DEFAULT_CASA_SLOTS);
    expect(squad.fieldSlots).not.toBe(0);
    expect(Number.isFinite(squad.fieldSlots)).toBe(true);
  });
});

describe('computeSquadFarmFacts — houseSlotDemand', () => {
  const syntheticHero = (uptime: number): HeroFarmFacts => ({
    heroId: 'synthetic',
    heroName: 'Synthetic',
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
  });

  it('is Σ (1 − uptime) — a hero that never rests (uptime 1) asks the House for nothing', () => {
    const squad = computeSquadFarmFacts([syntheticHero(1), syntheticHero(1), syntheticHero(1)], account);
    expect(squad.uptimeSum).toBe(3);
    expect(squad.houseSlotDemand).toBe(0);
  });

  it('a roster that never deploys (uptime 0) asks for a full slot each — the worst case, not a free one', () => {
    const squad = computeSquadFarmFacts([syntheticHero(0), syntheticHero(0)], account);
    expect(squad.uptimeSum).toBe(0);
    expect(squad.houseSlotDemand).toBe(2);
  });

  it('uptimeSum + houseSlotDemand === the roster size, for any mix', () => {
    const facts = [syntheticHero(0.1), syntheticHero(0.42), syntheticHero(0.9), syntheticHero(1)];
    const squad = computeSquadFarmFacts(facts, account);
    expect(squad.uptimeSum + squad.houseSlotDemand).toBeCloseTo(facts.length, 12);
  });

  it('the 5-hero fixture overcommits its 3-slot House (Σ uptime is well under 3, yet demand is over it)', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    expect(squad.uptimeSum).toBeLessThan(squad.houseSlots);
    expect(squad.houseSlotDemand).toBeGreaterThan(squad.houseSlots);
  });
});
