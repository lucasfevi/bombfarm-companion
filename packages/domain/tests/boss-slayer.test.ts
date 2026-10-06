import { describe, expect, it } from 'vitest';
import { ownAbilityReadout, isPricedReadout } from '@bombfarm/domain/ability-effect-readout';
import { abilityGainFor } from '@bombfarm/domain/ability-gain';
import { computeFarmRateRow, computeSquadFarmFacts, type HeroFarmFacts } from '@bombfarm/domain/farm-rate';
import { FUSE_FLOOR, STAT_CAPS, abilityMods } from '@bombfarm/domain/model';
import { BOSS_HP_MULT_WIKI, wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { hitsToKill, propHp } from '@bombfarm/domain/phases';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { runTeamPlan } from '@bombfarm/domain/team-plan';
import type { TeamPlanInput, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { FARM_RANK_FIXTURE, loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

const NON_GATE_PHASE = 19;
const GATE_PHASE = 20;

function carrier(avgHitBase: number, bossDmgMult?: number): HeroFarmFacts {
  return {
    heroId: 'synthetic',
    heroName: 'synthetic',
    avgHitBase,
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
    ...(bossDmgMult === undefined ? {} : { bossDmgMult }),
  };
}

const { account } = loadFarmRateFixture(FARM_RANK_FIXTURE);
const inertCeilings = { ...account, slots: 1000, fieldSlots: 1000 };

function rowFor(phase: number, hero: HeroFarmFacts) {
  return computeFarmRateRow(phase, computeSquadFarmFacts([hero], inertCeilings))!;
}

const gateLine = wikiPhaseLine(GATE_PHASE)!;
const bossHp = propHp(gateLine.hp, BOSS_HP_MULT_WIKI);
const hitThatNeedsFourBossHits = bossHp / 3.5;

describe('Boss Slayer in the ability catalogue', () => {
  it('multiplies the carrier damage against the boss by one plus five percent per rank', () => {
    expect(abilityMods({ matador_chefes: 0 }).bossDmgMult).toBe(1);
    expect(abilityMods({ matador_chefes: 7 }).bossDmgMult).toBeCloseTo(1.35, 12);
    expect(abilityMods({ matador_chefes: 20 }).bossDmgMult).toBeCloseTo(2, 12);
  });

  it('touches no other modifier', () => {
    const base = abilityMods({});
    const { bossDmgMult, ...others } = abilityMods({ matador_chefes: 20 });
    const { bossDmgMult: baseBoss, ...baseOthers } = base;
    expect(bossDmgMult).toBeGreaterThan(baseBoss);
    expect(others).toEqual(baseOthers);
  });

  it('reads as a priced damage readout in percent', () => {
    const readout = ownAbilityReadout('matador_chefes', 20);
    expect(readout.kind).toBe('bossDmgPct');
    expect(readout).toEqual({ kind: 'bossDmgPct', value: expect.closeTo(100, 9) });
    expect(isPricedReadout(readout)).toBe(true);
  });
});

describe('Boss Slayer in the Farm board', () => {
  it('divides the boss hits-to-kill by the multiplier, rounding up as hitsToKill does', () => {
    expect(hitsToKill(hitThatNeedsFourBossHits, bossHp)).toBe(4);
    expect(hitsToKill(hitThatNeedsFourBossHits * 1.5, bossHp)).toBe(3);
    expect(hitsToKill(hitThatNeedsFourBossHits * 2, bossHp)).toBe(2);
  });

  it('shortens a gate clear through the boss term alone', () => {
    const plain = rowFor(GATE_PHASE, carrier(hitThatNeedsFourBossHits));
    const slayer = rowFor(GATE_PHASE, carrier(hitThatNeedsFourBossHits, 2));
    expect(slayer.clearSecs).toBeLessThan(plain.clearSecs);
    expect(slayer.expectedHtk).toBe(plain.expectedHtk);
    expect(slayer.oneShot).toBe(plain.oneShot);
  });

  it('leaves a phase without a boss exactly as it was', () => {
    const plain = rowFor(NON_GATE_PHASE, carrier(hitThatNeedsFourBossHits));
    const slayer = rowFor(NON_GATE_PHASE, carrier(hitThatNeedsFourBossHits, 2));
    expect(slayer).toEqual(plain);
  });

  it('leaves the rock side of a gate untouched, so only the boss share of the cycle moves', () => {
    const plain = rowFor(GATE_PHASE, carrier(hitThatNeedsFourBossHits));
    const slayer = rowFor(GATE_PHASE, carrier(hitThatNeedsFourBossHits, 2));
    const plainBossSecs = plain.clearSecs - rowFor(NON_GATE_PHASE, carrier(hitThatNeedsFourBossHits)).clearSecs;
    const slayerBossSecs = slayer.clearSecs - rowFor(NON_GATE_PHASE, carrier(hitThatNeedsFourBossHits, 2)).clearSecs;
    expect(slayerBossSecs).toBeLessThan(plainBossSecs);
  });

  it('prices a hero without it exactly as one carrying the neutral multiplier', () => {
    const plain = carrier(hitThatNeedsFourBossHits);
    expect(rowFor(GATE_PHASE, plain)).toEqual(rowFor(GATE_PHASE, { ...plain, bossDmgMult: 1 }));
  });

  it('leaves a second hero on the field unaffected by the first one carrying it', () => {
    const slayer = carrier(hitThatNeedsFourBossHits, 2);
    const other = { ...carrier(hitThatNeedsFourBossHits), heroId: 'other', heroName: 'other' };
    const pairWithCarrier = computeSquadFarmFacts([slayer, other], inertCeilings);
    const pairWithout = computeSquadFarmFacts([carrier(hitThatNeedsFourBossHits), other], inertCeilings);
    expect(computeFarmRateRow(GATE_PHASE, pairWithCarrier)!.clearSecs).toBeGreaterThan(
      computeFarmRateRow(GATE_PHASE, computeSquadFarmFacts([slayer, slayer], inertCeilings))!.clearSecs,
    );
    expect(computeFarmRateRow(GATE_PHASE, pairWithCarrier)!.clearSecs).toBeLessThan(
      computeFarmRateRow(GATE_PHASE, pairWithout)!.clearSecs,
    );
  });
});

describe('Boss Slayer in the advisor', () => {
  const { heroes } = loadFarmRateFixture(FARM_RANK_FIXTURE);
  const phase = account.context.phase ?? 1;
  const mitigationPct = account.context.mitigationPct;
  const hero = heroes.find((candidate) => pipelineForHero(candidate, account, phase, mitigationPct).bossHits >= 2)!;
  const plain = pipelineForHero(hero, account, phase, mitigationPct);
  const slayer = pipelineForHero(withAbilityLevels(hero, { matador_chefes: 20 }), account, phase, mitigationPct);

  it('finds a fixture hero that needs more than one hit on the boss', () => {
    expect(hero).toBeDefined();
  });

  it('needs fewer hits on the boss', () => {
    expect(slayer.bossHits).toBeLessThan(plain.bossHits);
  });

  it('changes no rock figure, no damage rate and no gate row', () => {
    expect(slayer.propRows).toEqual(plain.propRows);
    expect(slayer.dps).toBe(plain.dps);
    expect(slayer.gateRows).toEqual(plain.gateRows);
  });

  it('prices a rank bump as measured nowhere in sustained damage, not as unmodelled', () => {
    const gains = abilityGainFor(withAbilityLevels(hero, { matador_chefes: 3 }), account, phase, mitigationPct);
    expect(gains.find((gain) => gain.abilityId === 'matador_chefes')?.state).toEqual({ kind: 'notMeasured' });
  });
});

describe('Boss Slayer in the duel and gate objectives', () => {
  const input: TeamPlanInput = loadTeamPlanFarmFixture('save-20260819-11882-7heroes.json').teamPlanInput;
  const slayerInput: TeamPlanInput = {
    ...input,
    heroes: input.heroes.map((hero) => ({ ...hero, abilities: { ...hero.abilities, matador_chefes: 20 } })),
  };

  function dpsFor(source: TeamPlanInput, objective: TeamPlanObjective) {
    const result = runTeamPlan({ ...source, objective, targetPhase: 60, allowedChanges: 'points' });
    if (result.blocked) throw new Error('plan blocked');
    return result.plan.currentDps;
  }

  it('a duel figure with a Boss Slayer 20 carrier equals the same hero without it', () => {
    expect(dpsFor(slayerInput, 'pvp')).toBe(dpsFor(input, 'pvp'));
  });

  it('the gate objective prices sustained damage over the timer and carries no boss share', () => {
    expect(dpsFor(slayerInput, 'gateClear')).toBe(dpsFor(input, 'gateClear'));
  });
});
