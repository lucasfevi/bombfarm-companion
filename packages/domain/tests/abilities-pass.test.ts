/**
 * The three combat abilities the catalog took on in one pass: Brecha as the fifth standing team
 * aura, Matilha as an own ability priced at the field size, and Passagem de Bastão as the sixth
 * team aura priced on a hero's own screen from the very rule the Farm board uses.
 *
 * Every figure here is either a published constant, a ratio of two of them, or a comparison
 * between two runs of the model — nothing is read off a capture and pinned.
 */
import { describe, expect, it } from 'vitest';
import { abilityGainFor } from '@bombfarm/domain/ability-gain';
import { computeCombatMults } from '@bombfarm/domain/derive';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  farmPricedAccount,
} from '@bombfarm/domain/farm-rate';
import {
  ABILITIES,
  MATILHA_CAP,
  MATILHA_PER_RANK_PER_ALLY,
  abilityMods,
  alliesOverRotation,
  matilhaMult,
} from '@bombfarm/domain/model';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  TEAM_BUFF_ABILITY_IDS,
  TEAM_BUFF_CAP,
  TEAM_BUFF_FIELDS,
  computeTeamBuffsAroundHero,
  computeTeamBuffsOverRotation,
  fieldAlliesAroundHero,
  noTeamAuraSwitches,
  zeroTeamBuffs,
} from '@bombfarm/domain/team-buffs';
import { teamAuraLayer } from '@bombfarm/domain/team-aura-layer';
import { FARM_RANK_FIXTURE, loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture(FARM_RANK_FIXTURE);
const PHASE = account.context.phase ?? 1;
const MITIGATION_PCT = account.context.mitigationPct;

function heroByName(name: string): HeroRecord {
  const hero = heroes.find((candidate) => candidate.name === name);
  if (!hero) throw new Error(`fixture hero "${name}" not found`);
  return hero;
}

/** The account a hero's own screen prices it on: its own auras, no other carrier switched on. */
function ownSeat(hero: HeroRecord, roster: readonly HeroRecord[] = heroes): AccountShared {
  return {
    ...account,
    teamBuffs: computeTeamBuffsAroundHero(hero, roster, noTeamAuraSwitches()),
    fieldAllies: fieldAlliesAroundHero(hero, roster),
  };
}

describe('Brecha — the fifth standing team aura', () => {
  it('sits in every enumeration of the standing auras, with the wiki cap and no special case', () => {
    expect(TEAM_BUFF_ABILITY_IDS).toContain('brecha');
    expect(TEAM_BUFF_CAP.brecha).toBe(20);
    expect(zeroTeamBuffs().brecha).toBe(0);
    expect(noTeamAuraSwitches().brecha).toBe(false);
    expect(TEAM_BUFF_FIELDS.map((field) => field.id)).toEqual([...TEAM_BUFF_ABILITY_IDS]);
    expect(ABILITIES.find((ability) => ability.id === 'brecha')?.effect).toEqual({
      kind: 'penetrationPp',
      perLevel: 1,
    });
  });

  it('never reaches the carrier\'s own mods or sheet — the points are the field\'s', () => {
    expect(abilityMods({ brecha: 20 })).toEqual(abilityMods({}));
  });

  it('rank 20 reads +20 penetration on every hero on the field', () => {
    const carrier = { abilities: { brecha: 20 } };
    const bystander = { abilities: {} };
    const total = computeTeamBuffsOverRotation([carrier, bystander], null);
    expect(total.brecha).toBe(20);
    expect(teamAuraLayer(total).teamPenFlat).toBe(20);
    expect(computeCombatMults({ mods: abilityMods({}), teamBuffs: total, extraDmgPct: 0 }).teamPenFlat).toBe(20);
  });

  it('caps at 20 with two rank-20 carriers', () => {
    const total = computeTeamBuffsOverRotation([{ abilities: { brecha: 20 } }, { abilities: { brecha: 20 } }], null);
    expect(total.brecha).toBe(20);
    expect(teamAuraLayer({ ...zeroTeamBuffs(), brecha: 40 }).teamPenFlat).toBe(20);
  });

  it('adds the capped total to the effective sheet after the pool, on a hero\'s own screen', () => {
    const hero = heroByName('IDK');
    const alone = pipelineForHero(hero, { ...account, teamBuffs: zeroTeamBuffs() }, PHASE, MITIGATION_PCT);
    const under = pipelineForHero(
      hero,
      { ...account, teamBuffs: { ...zeroTeamBuffs(), brecha: 12 } },
      PHASE,
      MITIGATION_PCT,
    );
    expect(under.teamPenFlat).toBe(12);
    expect(under.effective.penetration).toBeCloseTo(alone.effective.penetration + 12, 10);
    expect(under.adjusted.penetration).toBe(alone.adjusted.penetration);
  });

  it('counts the carrier\'s own rank on its own seat whether or not the game has it deployed', () => {
    const carrier = withAbilityLevels(heroByName('IDK'), { brecha: 7 });
    const deployed = computeTeamBuffsAroundHero({ ...carrier, deployed: true }, heroes, noTeamAuraSwitches());
    const benched = computeTeamBuffsAroundHero({ ...carrier, deployed: false }, heroes, noTeamAuraSwitches());
    expect(deployed.brecha).toBe(7);
    expect(benched).toEqual(deployed);
  });
});

describe('Matilha — an own ability priced at the field size', () => {
  it('carries the wiki\'s rate and cap', () => {
    expect(MATILHA_PER_RANK_PER_ALLY).toBe(0.005);
    expect(MATILHA_CAP).toBe(0.9);
    expect(ABILITIES.find((ability) => ability.id === 'matilha')?.effect).toEqual({
      kind: 'packDmgPct',
      perLevel: 0.5,
    });
    expect(abilityMods({ matilha: 20 }).packDmgPctPerAlly).toBe(10);
  });

  it('rank 20 with three heroes on the field prices ×1.20 — two allies beside the carrier', () => {
    expect(matilhaMult(MATILHA_PER_RANK_PER_ALLY * 20, 2)).toBe(1.2);
    const mults = computeCombatMults({ mods: abilityMods({ matilha: 20 }), teamBuffs: zeroTeamBuffs(), extraDmgPct: 0, fieldAllies: 2 });
    expect(mults.packMult).toBe(1.2);
    expect(mults.dmgMult).toBe(abilityMods({ matilha: 20 }).dmgMult * 1.2);
  });

  it('caps at ×1.90 with twenty allies', () => {
    expect(matilhaMult(MATILHA_PER_RANK_PER_ALLY * 20, 20)).toBe(1.9);
    expect(matilhaMult(MATILHA_PER_RANK_PER_ALLY * 20, 200)).toBe(1.9);
  });

  it('is ×1 alone on the field, and ×1 for a hero without the ability however crowded the field', () => {
    expect(matilhaMult(MATILHA_PER_RANK_PER_ALLY * 20, 0)).toBe(1);
    expect(matilhaMult(0, 5)).toBe(1);
    expect(computeCombatMults({ mods: abilityMods({}), teamBuffs: zeroTeamBuffs(), extraDmgPct: 0, fieldAllies: 5 }).packMult).toBe(1);
  });

  it('a hero\'s own screen counts the deployed heroes beside it, never the hero itself', () => {
    const roster = [
      { id: 'me', deployed: false },
      { id: 'a', deployed: true },
      { id: 'b', deployed: true },
      { id: 'c', deployed: false },
    ];
    expect(fieldAlliesAroundHero({ id: 'me' }, roster)).toBe(2);
    expect(fieldAlliesAroundHero({ id: 'a' }, roster)).toBe(1);
  });

  it('over a rotation, the allies are the other heroes\' presences summed, capped by the field\'s other slots', () => {
    const presence = [0.6, 0.5, 0.4];
    expect(alliesOverRotation(presence, 0, 10)).toBeCloseTo(0.9, 12);
    expect(alliesOverRotation(presence, 1, 10)).toBeCloseTo(1.0, 12);
    expect(alliesOverRotation([1, 1, 1, 1], 0, 3)).toBe(2);
    expect(alliesOverRotation([1], 0, 3)).toBe(0);
  });

  it('multiplies the carrier\'s damage on its own screen by exactly the pack factor', () => {
    const carrier = withAbilityLevels(heroByName('IDK'), { matilha: 20 });
    const alone = pipelineForHero(carrier, { ...ownSeat(carrier), fieldAllies: 0 }, PHASE, MITIGATION_PCT);
    const beside = pipelineForHero(carrier, { ...ownSeat(carrier), fieldAllies: 2 }, PHASE, MITIGATION_PCT);
    expect(alone.packMult).toBe(1);
    expect(beside.packMult).toBe(1.2);
    expect(beside.fieldAllies).toBe(2);
    expect(beside.dmgMult).toBeCloseTo(alone.dmgMult * 1.2, 12);
    expect(beside.effective).toEqual(alone.effective);
  });

  it('the Farm board prices each carrier at the allies its rotation keeps beside it', () => {
    // Fôlego is stripped from the pool so the presence the board seeds its field from — the
    // uptime at the pool's at-best Fôlego total — is the uptime its facts report, exactly.
    const pool = heroes.map((hero) => withAbilityLevels(hero, { folego_mineiro: 0 }));
    const carrier = withAbilityLevels(heroByName('IDK'), { folego_mineiro: 0, matilha: 20 });
    const roster = pool.map((hero) => (hero.id === carrier.id ? carrier : hero));
    const facts = computeHeroFarmFacts({ heroes: roster, account });
    const row = facts.find((fact) => fact.heroId === carrier.id);
    const withoutPack = computeHeroFarmFacts({ heroes: pool, account }).find((fact) => fact.heroId === carrier.id);
    if (!row || !withoutPack) throw new Error('carrier missing from the farm facts');

    const squad = computeSquadFarmFacts(facts, account);
    const allies = alliesOverRotation(facts.map((fact) => fact.uptime), facts.indexOf(row), squad.fieldSlots);
    expect(allies).toBeGreaterThan(0);
    expect(row.avgHitBase / withoutPack.avgHitBase).toBeCloseTo(matilhaMult(MATILHA_PER_RANK_PER_ALLY * 20, allies), 8);
    expect(farmPricedAccount({ heroes: roster, account }).teamBuffs.brecha).toBe(0);
  });
});

describe('Passagem de Bastão — the sixth team aura, on the hero\'s own seat', () => {
  it('is a team pulse in the catalog, priced as +4% per rank', () => {
    expect(ABILITIES.find((ability) => ability.id === 'passagem_bastao')?.effect).toEqual({
      kind: 'teamPulseDmgPct',
      perLevel: 4,
    });
  });

  it('a hero\'s own screen and the Farm board agree on the pulsed hit for the same hero', () => {
    const carrier = withAbilityLevels(heroByName('IDK'), { passagem_bastao: 20 });
    const seat = pipelineForHero(carrier, { ...account, teamBuffs: zeroTeamBuffs(), fieldAllies: 0 }, PHASE, MITIGATION_PCT);
    const squad = computeSquadFarmFacts(computeHeroFarmFacts({ heroes: [carrier], account }), account);

    expect(seat.entryPulse.levels.length).toBe(2);
    expect(seat.entryPulse).toEqual(squad.entryPulse);
    expect(seat.entryPulse.levels[1].mult).toBe(1.8);
    expect(seat.entryPulse.expectedMult).toBeGreaterThan(1);
  });

  it('scales the hero\'s sustained DPS by the pulse\'s expectation, and leaves the standing hit alone', () => {
    const hero = heroByName('IDK');
    const carrier = withAbilityLevels(hero, { passagem_bastao: 20 });
    const seat = { ...account, teamBuffs: zeroTeamBuffs(), fieldAllies: 0 };
    const plain = pipelineForHero(hero, seat, PHASE, MITIGATION_PCT);
    const pulsed = pipelineForHero(carrier, seat, PHASE, MITIGATION_PCT);

    expect(plain.entryPulse.expectedMult).toBe(1);
    expect(pulsed.dps).toBeCloseTo(plain.dps * pulsed.entryPulse.expectedMult, 8);
    expect(pulsed.active).toBeCloseTo(plain.active * pulsed.entryPulse.expectedMult, 8);
    expect(pulsed.predHit).toBe(plain.predHit);
    expect(pulsed.effective).toEqual(plain.effective);
  });

  it('an undeployed carrier\'s field time equals its deployed field time — its own auras are always on', () => {
    const carrier = withAbilityLevels(heroByName('IDK'), { folego_mineiro: 20, passagem_bastao: 10 });
    const deployed = pipelineForHero({ ...carrier, deployed: true }, ownSeat({ ...carrier, deployed: true }), PHASE, MITIGATION_PCT);
    const benched = pipelineForHero({ ...carrier, deployed: false }, ownSeat({ ...carrier, deployed: false }), PHASE, MITIGATION_PCT);

    expect(benched.fieldSecs).toBe(deployed.fieldSecs);
    expect(benched.entryPulse).toEqual(deployed.entryPulse);
    expect(benched.dps).toBe(deployed.dps);
  });
});

describe('abilityGainFor — the newly modelled abilities report a gain, the rest stay not modelled', () => {
  const base = heroByName('IDK');
  const seat = (hero: HeroRecord): AccountShared => ({ ...ownSeat(hero), fieldAllies: 3 });

  function stateOf(hero: HeroRecord, abilityId: string) {
    const row = abilityGainFor(hero, seat(hero), PHASE, MITIGATION_PCT).find((entry) => entry.abilityId === abilityId);
    if (!row) throw new Error(`"${abilityId}" is not in this hero's pool`);
    return row.state;
  }

  it('prices Matilha as a gain beside allies', () => {
    const state = stateOf(withAbilityLevels(base, { matilha: 5 }), 'matilha');
    expect(state.kind).toBe('gain');
    expect(state.kind === 'gain' && state.gainPct).toBeGreaterThan(0);
  });

  it('prices Brecha as a gain below its ceiling, and names the ceiling at it', () => {
    const below = stateOf(withAbilityLevels(base, { brecha: 5 }), 'brecha');
    expect(below.kind).toBe('gain');
    expect(below.kind === 'gain' && below.gainPct).toBeGreaterThan(0);

    const hero = withAbilityLevels(base, { brecha: 5 });
    const atCeiling = abilityGainFor(hero, { ...seat(hero), teamBuffs: { ...seat(hero).teamBuffs, brecha: 20 } }, PHASE, MITIGATION_PCT);
    expect(atCeiling.find((entry) => entry.abilityId === 'brecha')?.state).toEqual({ kind: 'auraAtCeiling' });
  });

  it('prices Passagem de Bastão as a gain', () => {
    const state = stateOf(withAbilityLevels(base, { passagem_bastao: 5 }), 'passagem_bastao');
    expect(state.kind).toBe('gain');
    expect(state.kind === 'gain' && state.gainPct).toBeGreaterThan(0);
  });

  it('keeps Fantasma, Caça-Hero, Veia de Ouro, Fortuna and Olho de Lapidador not modelled', () => {
    for (const abilityId of ['fantasma', 'caca_hero', 'veia_ouro', 'fortuna', 'olho_lapidador']) {
      expect(ABILITIES.find((ability) => ability.id === abilityId)?.effect).toEqual({ kind: 'none' });
      expect(stateOf(withAbilityLevels(base, { [abilityId]: 3 }), abilityId)).toEqual({ kind: 'notModelled' });
    }
  });
});
