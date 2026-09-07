/**
 * `abilityGainFor` prices one more level of each of a hero's abilities by re-running the same
 * combat model the rest of the app runs. The subjects come from the committed 11-hero capture,
 * mutated with `withAbilityLevels` where the roster carries no hero in the state under test —
 * every ability on it is either maxed or absent, so a below-max sheet ability has to be built.
 *
 * Nothing here asserts a number read off the capture. Every expectation is either a comparison
 * between two runs of the model made in the test itself, or a ratio of two published per-level
 * constants, so a balance patch moving the capture out of regime cannot make this file lie.
 */
import { describe, expect, it } from 'vitest';
import { abilityGainFor } from '@bombfarm/domain/ability-gain';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import { heroAbilityIds } from '@bombfarm/domain/hero-abilities';
import { ABILITIES, POINT_GAIN } from '@bombfarm/domain/model';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { FARM_RANK_FIXTURE, loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture(FARM_RANK_FIXTURE);

function fixturePhase(): number {
  const phase = account.context.phase;
  if (phase == null) throw new Error('fixture must carry account.phase');
  return phase;
}

const PHASE = fixturePhase();
const MITIGATION_PCT = account.context.mitigationPct;

function heroByName(name: string): HeroRecord {
  const hero = heroes.find((candidate) => candidate.name === name);
  if (!hero) throw new Error(`fixture hero "${name}" not found`);
  return hero;
}

function stateOf(hero: HeroRecord, abilityId: string, forAccount = account) {
  const row = abilityGainFor(hero, forAccount, PHASE, MITIGATION_PCT).find(
    (entry) => entry.abilityId === abilityId,
  );
  if (!row) throw new Error(`"${abilityId}" is not in this hero's pool`);
  return row.state;
}

function gainPctOf(hero: HeroRecord, abilityId: string, forAccount = account): number {
  const state = stateOf(hero, abilityId, forAccount);
  if (state.kind !== 'gain') throw new Error(`"${abilityId}" priced as "${state.kind}", not a gain`);
  return state.gainPct;
}

function dpsOf(hero: HeroRecord): number {
  return pipelineForHero(hero, account, PHASE, MITIGATION_PCT).dps;
}

function perLevelOf(abilityId: string): number {
  const effect = ABILITIES.find((ability) => ability.id === abilityId)?.effect;
  if (!effect || !('perLevel' in effect)) throw new Error(`"${abilityId}" has no per-level effect`);
  return effect.perLevel;
}

describe('abilityGainFor — the hero’s pool', () => {
  it('lists every ability in the pool exactly once, unspent slots included', () => {
    const joric = heroByName('Joric');
    expect(joric.abilities.misericordia).toBe(0);

    const rows = abilityGainFor(joric, account, PHASE, MITIGATION_PCT);
    const ids = rows.map((row) => row.abilityId);

    expect([...ids].sort()).toEqual([...heroAbilityIds(joric.abilities)].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(rows.find((row) => row.abilityId === 'misericordia')?.level).toBe(0);
  });
});

describe('abilityGainFor — states that are not a gain', () => {
  it('reports every ability of a hero with no birth roll as unavailable, and prices none of them', () => {
    const rows = abilityGainFor(
      { ...heroByName('Joric'), birth: undefined },
      account,
      PHASE,
      MITIGATION_PCT,
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.state.kind === 'unavailable')).toBe(true);
    expect(rows.every((row) => row.state.kind === 'unavailable' && row.state.reason === 'no-birth-roll')).toBe(true);
    expect(rows.some((row) => row.state.kind === 'gain')).toBe(false);
  });

  it('reports an ability at its maximum level as maxed rather than as a gain of zero', () => {
    const idk = heroByName('IDK');
    expect(idk.abilities.olho_clinico).toBe(20);

    expect(stateOf(idk, 'olho_clinico')).toEqual({ kind: 'maxed' });
  });

  it('reports an ability the model does not carry as not-modelled, without running the model', () => {
    const hale = heroByName('Hale');
    expect(heroAbilityIds(hale.abilities)).toEqual(['passagem_bastao']);

    resetEnergySwitchPointCallCount();
    const rows = abilityGainFor(hale, account, PHASE, MITIGATION_PCT);

    expect(rows.map((row) => row.state)).toEqual([{ kind: 'notModelled' }]);
    expect(energySwitchPointCallCount).toBe(0);
  });
});

/**
 * The whole approach rests on the pipeline recomposing its ability-derived contributions from the
 * abilities it is handed rather than trusting the hero's stored sheet. If either half of this
 * stopped holding, `abilityGainFor` would quietly return zeros for a whole class of abilities.
 */
describe('abilityGainFor — the model responds to the abilities it is handed', () => {
  it('moves the model when a SHEET-borne ability gains a level', () => {
    const hero = withAbilityLevels(heroByName('IDK'), { olho_clinico: 5 });
    const bumped = withAbilityLevels(hero, { olho_clinico: 6 });

    expect(dpsOf(bumped)).not.toBe(dpsOf(hero));
    expect(gainPctOf(hero, 'olho_clinico')).toBeGreaterThan(0);
  });

  it('moves the model when a NON-sheet ability gains a level', () => {
    const joric = heroByName('Joric');
    const bumped = withAbilityLevels(joric, { misericordia: 1 });

    expect(dpsOf(bumped)).not.toBe(dpsOf(joric));
    expect(gainPctOf(joric, 'misericordia')).toBeGreaterThan(0);
  });
});

describe('abilityGainFor — team auras', () => {
  const carrier = withAbilityLevels(heroByName('IDK'), { grito_guerra: 5 });

  it('prices a team aura below its field-wide ceiling as a real gain', () => {
    const belowCeiling = { ...account, teamBuffs: { ...account.teamBuffs, grito_guerra: 5 } };

    expect(gainPctOf(carrier, 'grito_guerra', belowCeiling)).toBeGreaterThan(0);
  });

  it('reports the ceiling, not a gain, when the roster total already sits at the aura’s cap', () => {
    const atCeiling = { ...account, teamBuffs: { ...account.teamBuffs, grito_guerra: 20 } };

    expect(stateOf(carrier, 'grito_guerra', atCeiling)).toEqual({ kind: 'auraAtCeiling' });
  });
});

/**
 * One ability level and one stat point have to land on one scale, or the two cannot be compared.
 * Golpe Brutal and the crit-damage stat point are both FLAT additions to the same sheet field, so
 * their gains must stand in exactly the ratio of their published per-level amounts — a ratio of
 * two constants, with no number copied out of a run.
 */
describe('abilityGainFor — units', () => {
  it('reports gains on the next-point ranking’s own scale', () => {
    const hero = withAbilityLevels(heroByName('IDK'), { golpe_brutal: 0 });
    const critDmgPoint = pipelineForHero(hero, account, PHASE, MITIGATION_PCT).ranking.find(
      (row) => row.stat === 'critDmg',
    );

    expect(critDmgPoint?.gainPct).toBeGreaterThan(0);
    expect(gainPctOf(hero, 'golpe_brutal')).toBeCloseTo(
      critDmgPoint!.gainPct * (perLevelOf('golpe_brutal') / POINT_GAIN.critDmgFlat),
      10,
    );
  });
});
