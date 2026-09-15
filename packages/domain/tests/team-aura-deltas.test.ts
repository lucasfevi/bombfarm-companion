/**
 * `teamAuraDpsDeltas` is the "+x% if on / −x% if off" column of the Abilities & auras section:
 * one pipeline run per aura, on the same input the figures came from. Every expectation here is a
 * comparison between runs of the model made in the test itself, never a number read off the
 * capture.
 */
import { describe, expect, it } from 'vitest';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { advisorInputForHero, pipelineForHero } from '@bombfarm/domain/roster-dps';
import { flipTeamAura, teamAuraDpsDeltas } from '@bombfarm/domain/team-aura-deltas';
import {
  PASSAGEM_BASTAO_RANK_CAP,
  TEAM_AURA_SWITCH_IDS,
  TEAM_BUFF_ABILITY_IDS,
  TEAM_BUFF_CAP,
  computeTeamBuffsAroundHero,
  entryPulseRankFloor,
  noTeamAuraSwitches,
  zeroTeamBuffs,
} from '@bombfarm/domain/team-buffs';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { FARM_RANK_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture(FARM_RANK_FIXTURE);
const PHASE = account.context.phase ?? 1;
const MITIGATION_PCT = account.context.mitigationPct;

function seated(hero: HeroRecord, switches = noTeamAuraSwitches()): AccountShared {
  return {
    ...account,
    teamBuffs: computeTeamBuffsAroundHero(hero, switches),
    entryPulseRankFloor: entryPulseRankFloor(switches),
  };
}

const hero = heroes.find((candidate) => candidate.birth != null && (candidate.abilities.grito_guerra ?? 0) === 0);
if (!hero) throw new Error('fixture must hold a birth-backed hero carrying no War Cry');

describe('flipTeamAura', () => {
  it('sends an aura in force to zero and an absent one to its cap, touching nothing else', () => {
    const base = { ...zeroTeamBuffs(), grito_guerra: 12 };
    expect(flipTeamAura(base, 'grito_guerra')).toEqual({ ...zeroTeamBuffs(), grito_guerra: 0 });
    expect(flipTeamAura(base, 'folego_mineiro')).toEqual({
      ...zeroTeamBuffs(),
      grito_guerra: 12,
      folego_mineiro: TEAM_BUFF_CAP.folego_mineiro,
    });
  });
});

describe('teamAuraDpsDeltas', () => {
  it('has one signed entry per modelled aura', () => {
    const input = advisorInputForHero(hero, seated(hero), PHASE, MITIGATION_PCT);
    const deltas = teamAuraDpsDeltas(input, computeAdvisorPipeline(input).dps);
    expect(Object.keys(deltas).sort()).toEqual([...TEAM_AURA_SWITCH_IDS].sort());
  });

  it('"+x% if on" for an absent War Cry equals the move sustained DPS makes when its switch is flipped on', () => {
    const off = pipelineForHero(hero, seated(hero), PHASE, MITIGATION_PCT);
    const on = pipelineForHero(hero, seated(hero, { ...noTeamAuraSwitches(), grito_guerra: true }), PHASE, MITIGATION_PCT);
    const deltas = teamAuraDpsDeltas(advisorInputForHero(hero, seated(hero), PHASE, MITIGATION_PCT), off.dps);

    expect(deltas.grito_guerra).toBeGreaterThan(0);
    expect(deltas.grito_guerra).toBeCloseTo((on.dps / off.dps - 1) * 100, 9);
  });

  it('"−x% if off" for a switched-on War Cry is the mirror of the same two runs', () => {
    const switches = { ...noTeamAuraSwitches(), grito_guerra: true };
    const on = pipelineForHero(hero, seated(hero, switches), PHASE, MITIGATION_PCT);
    const off = pipelineForHero(hero, seated(hero), PHASE, MITIGATION_PCT);
    const deltas = teamAuraDpsDeltas(advisorInputForHero(hero, seated(hero, switches), PHASE, MITIGATION_PCT), on.dps);

    expect(deltas.grito_guerra).toBeLessThan(0);
    expect(deltas.grito_guerra).toBeCloseTo((off.dps / on.dps - 1) * 100, 9);
  });

  it('a carried aura reads "if off": the hero’s own rank taken away, not topped up', () => {
    const carrier: HeroRecord = { ...hero, abilities: { ...hero.abilities, grito_guerra: 12 } };
    const withOwn = pipelineForHero(carrier, seated(carrier), PHASE, MITIGATION_PCT);
    const without = pipelineForHero(carrier, { ...account, teamBuffs: zeroTeamBuffs() }, PHASE, MITIGATION_PCT);
    const deltas = teamAuraDpsDeltas(advisorInputForHero(carrier, seated(carrier), PHASE, MITIGATION_PCT), withOwn.dps);

    expect(deltas.grito_guerra).toBeCloseTo((without.dps / withOwn.dps - 1) * 100, 9);
  });

  it('every aura’s delta is the move its own flip makes, whatever its size', () => {
    const base = seated(hero);
    const baseline = pipelineForHero(hero, base, PHASE, MITIGATION_PCT).dps;
    const deltas = teamAuraDpsDeltas(advisorInputForHero(hero, base, PHASE, MITIGATION_PCT), baseline);
    for (const buffId of TEAM_BUFF_ABILITY_IDS) {
      const flipped = pipelineForHero(hero, { ...base, teamBuffs: flipTeamAura(base.teamBuffs, buffId) }, PHASE, MITIGATION_PCT);
      expect(deltas[buffId], buffId).toBeCloseTo((flipped.dps / baseline - 1) * 100, 9);
    }
  });

  it('Baton Pass flips the hero’s own entry pulse: an absent pulse is priced at the cap rank, a pulse in force is taken away', () => {
    const off = pipelineForHero(hero, seated(hero), PHASE, MITIGATION_PCT);
    const on = pipelineForHero(hero, seated(hero, { ...noTeamAuraSwitches(), passagem_bastao: true }), PHASE, MITIGATION_PCT);
    expect(on.dps).toBeGreaterThan(off.dps);
    const deltasOff = teamAuraDpsDeltas(advisorInputForHero(hero, seated(hero), PHASE, MITIGATION_PCT), off.dps);
    expect(deltasOff.passagem_bastao).toBeCloseTo((on.dps / off.dps - 1) * 100, 9);

    const carrier: HeroRecord = { ...hero, abilities: { ...hero.abilities, passagem_bastao: PASSAGEM_BASTAO_RANK_CAP } };
    const withOwn = pipelineForHero(carrier, seated(carrier), PHASE, MITIGATION_PCT);
    expect(withOwn.dps).toBeCloseTo(on.dps, 6);
    const deltasOn = teamAuraDpsDeltas(advisorInputForHero(carrier, seated(carrier), PHASE, MITIGATION_PCT), withOwn.dps);
    expect(deltasOn.passagem_bastao).toBeCloseTo((off.dps / withOwn.dps - 1) * 100, 9);
  });

  it('reads all zeros against a zero baseline rather than dividing by it', () => {
    const input = advisorInputForHero(hero, seated(hero), PHASE, MITIGATION_PCT);
    expect(teamAuraDpsDeltas(input, 0)).toEqual({ ...zeroTeamBuffs(), passagem_bastao: 0 });
  });
});
