import { describe, expect, it } from 'vitest';
import { computeAdvisorPipeline, type AdvisorPipelineInput } from '@bombfarm/domain/advisor-pipeline';
import { emptyLoadout, type SheetStats } from '@bombfarm/domain/gear';
import { PROPS } from '@bombfarm/domain/phases';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { teamAuraLayer } from '@bombfarm/domain/team-aura-layer';
import {
  TEAM_BUFF_CAP,
  computeTeamBuffsFromDeployed,
  computeTeamBuffsOverRotation,
  zeroTeamBuffs,
} from '@bombfarm/domain/team-buffs';

const naked: SheetStats = {
  attack: 200,
  energy: 400,
  speed: 55,
  critChance: 60,
  critDmg: 80,
  penetration: 5,
  cdr: 4,
  luck: 15,
};

function pipelineWith(carnificina: number) {
  const input: AdvisorPipelineInput = {
    naked,
    geared: { ...naked },
    loadout: emptyLoadout(),
    altLoadout: null,
    pts: ZERO_PTS(),
    abilities: {},
    rarity: 'Comum',
    level: 1,
    stars: 0,
    treeDanoTotal: 1,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeSpeed: 0,
    treeEnergy: 0,
    treeLuckFlatPct: 0,
    teamBuffs: { ...zeroTeamBuffs(), carnificina },
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    rankMode: 'dps',
    targetProp: PROPS[1]?.name ?? PROPS[0].name,
  };
  return computeAdvisorPipeline(input);
}

const carriers = (...ranks: number[]) => ranks.map((rank) => ({ abilities: { carnificina: rank } }));
const totalFor = (...ranks: number[]) => teamAuraLayer(computeTeamBuffsOverRotation(carriers(...ranks), null)).teamCritDmgFlat;

describe('Carnage is a team crit-damage aura', () => {
  it('one carrier at rank 20 gives +100 crit-damage points', () => {
    expect(totalFor(20)).toBe(100);
  });

  it('two carriers at rank 20 give +100, not +200', () => {
    expect(totalFor(20, 20)).toBe(100);
  });

  it('a rank-10 and a rank-20 carrier cap at one carrier maximum', () => {
    expect(totalFor(10, 20)).toBe(100);
  });

  it('two rank-5 carriers add up below the cap', () => {
    expect(totalFor(5, 5)).toBe(50);
  });

  it('is capped at one carrier maximum even when summed from the deployed field', () => {
    const deployed = [20, 20, 20].map((rank) => ({ deployed: true, abilities: { carnificina: rank } }));
    const totals = computeTeamBuffsFromDeployed(deployed);
    expect(teamAuraLayer(totals).teamCritDmgFlat).toBe(TEAM_BUFF_CAP.carnificina);
  });

  it('counts only the carriers standing in the field, weighted by presence', () => {
    const halfPresent = teamAuraLayer(computeTeamBuffsOverRotation(carriers(20), [0.5])).teamCritDmgFlat;
    expect(halfPresent).toBeCloseTo(50, 9);
  });

  it('adds to the crit damage of a hero that does not carry it, without touching crit chance', () => {
    const without = pipelineWith(0);
    const withAura = pipelineWith(100);
    expect(withAura.effective.critDmg - without.effective.critDmg).toBe(100);
    expect(withAura.effective.critChance).toBe(without.effective.critChance);
  });

  it('raises active damage for a crit-capable hero', () => {
    expect(pipelineWith(100).active).toBeGreaterThan(pipelineWith(0).active);
  });

  it('never prices more than the cap even if handed a larger total', () => {
    expect(pipelineWith(300).effective.critDmg).toBe(pipelineWith(100).effective.critDmg);
  });
});
