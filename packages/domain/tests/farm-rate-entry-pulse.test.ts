/**
 * Passagem de Bastão on the Farm board — a team aura that is up in pulses, priced as the other
 * auras are: every carrier in the pool lights the whole field for its own share of wall clock,
 * overlaps summed and capped inside the expectation — and then priced through the board's own
 * hits-to-kill step at every level rather than averaged into the hit.
 *
 * No fixed point is needed and none is run: the pulse moves the hit, and nothing the hit moves
 * reaches the pulse's inputs. Field seconds are `energy / drainMult` and duty is `F / (F + T)`,
 * neither of which depends on damage, so the one-round reading is exact — the same reason the
 * Optimizer applies its expectation once per round outside its aura fixed point.
 */
import { describe, expect, it } from 'vitest';
import {
  computeFarmRateRow,
  computeFarmRates,
  computeHeroFarmBases,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  farmTeamBuffs,
  heroFactsFromBasis,
  heroFarmBasisFromParts,
  squadFactsFromBases,
  type HeroFarmFacts,
  type SquadFarmAccount,
} from '@bombfarm/domain/farm-rate';
import {
  ABILITY_LEVEL_MAX,
  FUSE_FLOOR,
  PASSAGEM_BASTAO_CAPPED_PULSE,
  STAT_CAPS,
  fieldSeconds,
  mitigationFactor,
  passagemBastaoFieldPulse,
  passagemBastaoPresence,
} from '@bombfarm/domain/model';
import { WIKI_PROPS, wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { hitsToKill, propHp } from '@bombfarm/domain/phases';
import type { AccountShared } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();
const NO_CARRIER = heroes.every((hero) => !(hero.abilities.passagem_bastao ?? 0));

/** Nothing rationed, so a one-hero row is that hero's own unconstrained rate. */
const UNCONSTRAINED: AccountShared = { ...account, slots: 1000, fieldSlots: 1000 };

const PROP_WEIGHT_TOTAL = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);
function handEHtk(stoneHp: number, avgHit: number): number {
  return WIKI_PROPS.reduce(
    (sum, prop) => sum + (prop.weight / PROP_WEIGHT_TOTAL) * hitsToKill(avgHit, propHp(stoneHp, prop.hpMult)),
    0,
  );
}

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
    fuseFloorSecs: FUSE_FLOOR,
    cdrCapPct: STAT_CAPS.cdr,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 0.5,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

function rowFor(squadHeroes: readonly HeroFarmFacts[], phase: number) {
  return computeFarmRateRow(phase, computeSquadFarmFacts(squadHeroes, UNCONSTRAINED))!;
}

describe('the basis carries the rank, the facts carry each carrier, the squad carries the field', () => {
  it('the fixture roster has no carrier, so no hero carries one and the squad reads ×1', () => {
    expect(NO_CARRIER).toBe(true);
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    for (const facts of heroFacts) expect(facts.passagemBastao).toBeUndefined();
    expect(computeSquadFarmFacts(heroFacts, account).entryPulse).toEqual({
      levels: [{ mult: 1, probability: 1 }],
      expectedMult: 1,
    });
  });

  it('a rank-20 carrier lights the field for 120 s of every rotation cycle it has', () => {
    const carrier = withAbilityLevels(heroes[0], { passagem_bastao: 20 });
    const [basis] = computeHeroFarmBases({ heroes: [carrier], account });
    const facts = heroFactsFromBasis(basis, basis.pts);
    const stint = fieldSeconds(basis.effective, basis.context);
    const cycle = stint / facts.uptime;

    expect(basis.passagemBastaoLevel).toBe(20);
    expect(facts.passagemBastao?.rank).toBe(20);
    expect(facts.passagemBastao?.presence).toBeCloseTo(120 / cycle, 12);
    expect(facts.passagemBastao?.presence).toBe(passagemBastaoPresence(stint, facts.uptime));
  });

  it('the squad folds every carrier into the one field pulse the auras are priced in', () => {
    const roster = [
      withAbilityLevels(heroes[0], { passagem_bastao: 20 }),
      withAbilityLevels(heroes[1], { passagem_bastao: 7 }),
      heroes[2],
    ];
    const heroFacts = computeHeroFarmFacts({ heroes: roster, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    const carriers = heroFacts.flatMap((hero) => (hero.passagemBastao ? [hero.passagemBastao] : []));
    expect(carriers).toHaveLength(2);
    expect(squad.entryPulse).toEqual(passagemBastaoFieldPulse(carriers));
    // Off, the rank-7 pulse alone, and the cap — which the rank-20 pulse reaches alone and the
    // two together do not exceed, so their overlap is not a level of its own.
    expect(squad.entryPulse.levels.map((level) => level.mult)).toEqual([1, 1.28, 1.8]);
  });

  it('the rank is clamped like every other ability level, so the second producer cannot over-credit it', () => {
    const [basis] = computeHeroFarmBases({ heroes: [heroes[0]], account });
    const parts = {
      heroId: basis.heroId,
      heroName: basis.heroName,
      level: basis.level,
      pts: basis.pts,
      effective: basis.effective,
      effectiveDelta: basis.effectiveDelta,
      context: basis.context,
      dmgMult: basis.dmgMult,
      adjustedLuckPct: basis.heroLuckPct,
      treeLuckFlatPct: 0,
    };
    expect(heroFarmBasisFromParts({ ...parts, abilities: { passagem_bastao: 99 } }).passagemBastaoLevel).toBe(
      ABILITY_LEVEL_MAX,
    );
    expect(heroFarmBasisFromParts({ ...parts, abilities: {} }).passagemBastaoLevel).toBe(0);
  });
});

describe('the whole field is lit, not the carrier alone', () => {
  const phase = 42;

  it('a hero without the ability is priced through the carrier’s pulse too', () => {
    const carrier = syntheticHero({ heroId: 'carrier', avgHitBase: 60, passagemBastao: { rank: 20, presence: 0.5 } });
    const bystander = syntheticHero({ heroId: 'bystander', avgHitBase: 60 });
    const alone = rowFor([bystander], phase);
    const withCarrier = rowFor([carrier, bystander], phase);
    const withDudCarrier = rowFor([{ ...carrier, passagemBastao: undefined }, bystander], phase);
    // Two identical heroes double the rate; the pulse is what separates the two pairs.
    expect(withCarrier.propsPerHour).toBeGreaterThan(withDudCarrier.propsPerHour);
    expect(withDudCarrier.propsPerHour).toBeGreaterThan(alone.propsPerHour);
  });

  it('a carrier whose pulse is always up is a ×(1 + 0.04 × rank) hit for everyone, the whole time', () => {
    const lit = [
      syntheticHero({ heroId: 'carrier', avgHitBase: 60, passagemBastao: { rank: 20, presence: 1 } }),
      syntheticHero({ heroId: 'bystander', avgHitBase: 45 }),
    ];
    const standing = lit.map((hero) => ({ ...hero, passagemBastao: undefined, avgHitBase: hero.avgHitBase * 1.8 }));
    for (const p of [10, 42, 137]) {
      expect(rowFor(lit, p).goldPerHour).toBeCloseTo(rowFor(standing, p).goldPerHour, 6);
      expect(rowFor(lit, p).expectedHtk).toBeCloseTo(rowFor(standing, p).expectedHtk, 9);
      expect(rowFor(lit, p).oneShot).toBe(rowFor(standing, p).oneShot);
    }
  });
});

describe('a pool without the ability prices bit for bit as before', () => {
  const heroFacts = computeHeroFarmFacts({ heroes, account });
  const stripped = heroFacts.map(({ passagemBastao: _carrier, ...rest }) => rest as HeroFarmFacts);

  it('no carrier and a rank-0 pulse are the same row', () => {
    for (const phase of [1, 26, 42, 100, 300]) {
      const withField = computeFarmRateRow(phase, computeSquadFarmFacts(heroFacts, account))!;
      const without = computeFarmRateRow(phase, computeSquadFarmFacts(stripped, account))!;
      expect(withField).toEqual(without);
    }
  });
});

describe('every level goes through its own hits-to-kill step', () => {
  const phase = 42;
  const line = wikiPhaseLine(phase)!;
  const mitF = mitigationFactor(line.mitig, 0);
  // A standing hit that needs two hits on the stone and one under the pulse: the threshold
  // sits between the two, so a time-averaged hit would land on one side of it or the other and
  // describe a field that exists at neither level.
  const stoneHp = propHp(line.hp, 1);
  const avgHitBase = (0.7 * stoneHp) / mitF;

  it('a pulse up half the time blends the two RATES, not the two hits', () => {
    expect(hitsToKill(avgHitBase * mitF, stoneHp)).toBe(2);
    expect(hitsToKill(avgHitBase * mitF * 1.8, stoneHp)).toBe(1);

    const half = rowFor([syntheticHero({ heroId: 'half', avgHitBase, passagemBastao: { rank: 20, presence: 0.5 } })], phase);
    const standing = rowFor([syntheticHero({ heroId: 'standing', avgHitBase })], phase);
    const pulsed = rowFor([syntheticHero({ heroId: 'pulsed', avgHitBase: avgHitBase * 1.8 })], phase);
    // Half the clock at each level: the props per hour are the mean of the two rates, and the
    // hits per kill are weighted by the kills each level delivers — never a single averaged hit.
    expect(half.propsPerHour).toBeCloseTo((standing.propsPerHour + pulsed.propsPerHour) / 2, 6);
    expect(half.expectedHtk).toBeCloseTo(
      (standing.propsPerHour * standing.expectedHtk + pulsed.propsPerHour * pulsed.expectedHtk) /
        (standing.propsPerHour + pulsed.propsPerHour),
      9,
    );
    const averagedHit = syntheticHero({ heroId: 'avg', avgHitBase: avgHitBase * 1.4 });
    expect(half.propsPerHour).not.toBeCloseTo(rowFor([averagedHit], phase).propsPerHour, 3);
  });

  it('two carriers price four levels, each through its own clear', () => {
    const carriers = [
      syntheticHero({ heroId: 'a', avgHitBase, passagemBastao: { rank: 5, presence: 0.5 } }),
      syntheticHero({ heroId: 'b', avgHitBase, passagemBastao: { rank: 10, presence: 0.2 } }),
    ];
    const pulse = passagemBastaoFieldPulse([
      { rank: 5, presence: 0.5 },
      { rank: 10, presence: 0.2 },
    ]);
    expect(pulse.levels.length).toBe(4);
    const row = rowFor(carriers, phase);
    const expectedPropsPerHour = pulse.levels.reduce((sum, level) => {
      const atLevel = carriers.map((hero) => ({ ...hero, passagemBastao: undefined, avgHitBase: hero.avgHitBase * level.mult }));
      return sum + level.probability * rowFor(atLevel, phase).propsPerHour;
    }, 0);
    expect(row.propsPerHour).toBeCloseTo(expectedPropsPerHour, 6);
  });

  it('the pulse reaches the boss the same way, so a gate clear is credited too', () => {
    const gatePhase = [...Array(200).keys()].map((i) => i + 1).find((p) => wikiPhaseLine(p)?.gate)!;
    const standing = syntheticHero({ heroId: 'standing', avgHitBase: 50 });
    const pulsed = syntheticHero({ heroId: 'pulsed', avgHitBase: 50, passagemBastao: { rank: 20, presence: 0.5 } });
    expect(rowFor([pulsed], gatePhase).clearSecs).toBeLessThan(rowFor([standing], gatePhase).clearSecs);
  });

  it('hits per second are untouched — the pulse is a damage term, never a cadence one', () => {
    const standing = syntheticHero({ heroId: 'standing', avgHitBase: 1e9 });
    const pulsed = syntheticHero({ heroId: 'pulsed', avgHitBase: 1e9, passagemBastao: { rank: 20, presence: 0.5 } });
    // Both one-shot everything, so the rate is hits per second alone and the pulse has nothing
    // left to move.
    expect(rowFor([pulsed], phase).propsPerHour).toBe(rowFor([standing], phase).propsPerHour);
    expect(rowFor([pulsed], phase).propsPerHour).toBeGreaterThan(0);
  });
});

describe('aurasAtCap naming the ability holds the field at the cap whatever the pool lights', () => {
  const phase = 42;
  const HELD: SquadFarmAccount = { ...UNCONSTRAINED, aurasAtCap: ['passagem_bastao'] };
  const atCap = (squadHeroes: readonly HeroFarmFacts[]) =>
    computeFarmRateRow(phase, computeSquadFarmFacts(squadHeroes, HELD))!;

  it('a pool with no carrier prices as one whose rank-20 pulse never drops', () => {
    const bystander = syntheticHero({ heroId: 'bystander', avgHitBase: 60 });
    const lit = syntheticHero({ heroId: 'lit', avgHitBase: 60, passagemBastao: { rank: 20, presence: 1 } });
    expect(atCap([bystander])).toEqual(rowFor([lit], phase));
  });

  it('a part-time low-rank carrier is lifted to the cap, never left at what it sustains', () => {
    const carrier = syntheticHero({ heroId: 'carrier', avgHitBase: 60, passagemBastao: { rank: 5, presence: 0.3 } });
    const lit = { ...carrier, passagemBastao: { rank: 20, presence: 1 } };
    expect(atCap([carrier])).toEqual(rowFor([lit], phase));
    expect(atCap([carrier]).goldPerHour).toBeGreaterThan(rowFor([carrier], phase).goldPerHour);
  });

  it('a pool already at the cap the whole time is unchanged by the option', () => {
    const lit = syntheticHero({ heroId: 'lit', avgHitBase: 60, passagemBastao: { rank: 20, presence: 1 } });
    expect(atCap([lit])).toEqual(rowFor([lit], phase));
  });

  it('the squad carries the held pulse; an empty list or another aura leaves the pool’s own', () => {
    const carrier = syntheticHero({ heroId: 'carrier', avgHitBase: 60, passagemBastao: { rank: 5, presence: 0.3 } });
    const own = computeSquadFarmFacts([carrier], UNCONSTRAINED).entryPulse;
    expect(own.levels.map((level) => level.mult)).toEqual([1, 1.2]);
    expect(computeSquadFarmFacts([carrier], { ...UNCONSTRAINED, aurasAtCap: [] }).entryPulse).toEqual(own);
    expect(computeSquadFarmFacts([carrier], { ...UNCONSTRAINED, aurasAtCap: ['grito_guerra'] }).entryPulse).toEqual(own);
    expect(computeSquadFarmFacts([carrier], HELD).entryPulse).toBe(PASSAGEM_BASTAO_CAPPED_PULSE);
  });

  it('computeFarmRates reads it off the account, so every row is priced at the cap', () => {
    const roster = [withAbilityLevels(heroes[0], { passagem_bastao: 3 }), heroes[1]];
    const capped = computeFarmRates({ heroes: roster, account: { ...account, aurasAtCap: ['passagem_bastao'] } });
    const plain = computeFarmRates({ heroes: roster, account });
    expect(capped.squad.entryPulse).toBe(PASSAGEM_BASTAO_CAPPED_PULSE);
    expect(capped.heroFacts).toEqual(plain.heroFacts);
    for (const [index, row] of capped.rows.entries()) {
      expect(row.goldPerHour).toBeGreaterThanOrEqual(plain.rows[index]!.goldPerHour);
    }
  });
});

describe('aurasAtCap naming a standing aura holds it in the layer every basis is priced at', () => {
  it('War Cry at cap lifts every enabled hero’s hit, reports 20 from farmTeamBuffs, and moves nothing else', () => {
    const plain = { heroes, account };
    const held = { heroes, account: { ...account, aurasAtCap: ['grito_guerra'] as const } };
    expect(farmTeamBuffs(held).grito_guerra).toBe(20);
    expect(farmTeamBuffs(held).brecha).toBe(farmTeamBuffs(plain).brecha);
    const before = computeHeroFarmFacts(plain);
    const after = computeHeroFarmFacts(held);
    expect(after).toHaveLength(before.length);
    for (const [index, facts] of after.entries()) {
      expect(facts.avgHitBase).toBeGreaterThan(before[index]!.avgHitBase);
      expect(facts.uptime).toBe(before[index]!.uptime);
      expect(facts.plantsPerSec).toBe(before[index]!.plantsPerSec);
    }
  });

  it('Fôlego at cap reaches field seconds, so uptime moves — the hold is applied before presences are weighed', () => {
    const before = computeHeroFarmFacts({ heroes, account });
    const after = computeHeroFarmFacts({ heroes, account: { ...account, aurasAtCap: ['folego_mineiro'] } });
    expect(after.some((facts, index) => facts.uptime > before[index]!.uptime)).toBe(true);
  });

  it('a candidate assignment priced through squadFactsFromBases holds the same auras', () => {
    const heldAccount = { ...account, aurasAtCap: ['grito_guerra'] as const };
    const bases = computeHeroFarmBases({ heroes, account: heldAccount });
    const viaBases = squadFactsFromBases(bases, null, heldAccount);
    const direct = computeSquadFarmFacts(computeHeroFarmFacts({ heroes, account: heldAccount }), heldAccount);
    expect(viaBases.heroes.map((hero) => hero.avgHitBase)).toEqual(direct.heroes.map((hero) => hero.avgHitBase));
  });
});

describe('oneShot reads the hit at the lowest level the field ever sits at', () => {
  const phase = 42;
  const line = wikiPhaseLine(phase)!;
  const mitF = mitigationFactor(line.mitig, 0);
  const maxPropHp = line.hp * Math.max(...WIKI_PROPS.map((prop) => prop.hpMult));
  // One-shots every prop under the pulse, and only the lighter ones without it.
  const avgHitBase = (0.7 * maxPropHp) / mitF;

  it('a pulse that is sometimes down does not make a one-shot squad', () => {
    const row = rowFor([syntheticHero({ heroId: 'part', avgHitBase, passagemBastao: { rank: 20, presence: 0.4 } })], phase);
    expect(row.oneShot).toBe(false);
  });

  it('a pulse that is always up does', () => {
    const row = rowFor([syntheticHero({ heroId: 'whole', avgHitBase, passagemBastao: { rank: 20, presence: 1 } })], phase);
    expect(row.oneShot).toBe(true);
  });
});
