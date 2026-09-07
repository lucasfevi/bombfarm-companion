import { describe, expect, it } from 'vitest';
import { emptyLoadout, type SheetStats } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { PROPS } from '@bombfarm/domain/phases';
import { fuseSeconds, FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { computeAdvisorPipeline, type AdvisorPipelineInput } from '@bombfarm/domain/advisor-pipeline';

const sheetWithCdr = (cdr: number): SheetStats => ({
  attack: 200,
  energy: 400,
  speed: 55,
  critChance: 10,
  critDmg: 80,
  penetration: 5,
  cdr,
  luck: 15,
});

function inputWithCdr(cdr: number): AdvisorPipelineInput {
  const naked = sheetWithCdr(cdr);
  return {
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
    teamBuffs: zeroTeamBuffs(),
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    rankMode: 'dps',
    targetProp: PROPS[1]?.name ?? PROPS[0].name,
  };
}

describe('advisor pipeline fuse figures', () => {
  it.each([0, 25, 40, STAT_CAPS.cdr, STAT_CAPS.cdr + 15, 100])(
    'reports the fuse the shared model computes for the effective sheet at %s%% cooldown reduction',
    (cdr) => {
      const out = computeAdvisorPipeline(inputWithCdr(cdr));

      expect(out.fuseSecs).toBe(fuseSeconds(out.effective.cdr));
    },
  );

  it('reports the floor and the cooldown cap as themselves, not as each other', () => {
    const out = computeAdvisorPipeline(inputWithCdr(0));

    expect(out.fuseFloorSecs).toBe(FUSE_FLOOR);
    expect(out.cdrCapPct).toBe(STAT_CAPS.cdr);
  });

  it('never reports a fuse below the floor, and the fuse falls as cooldown reduction rises', () => {
    const fuses = [0, 25, 40, STAT_CAPS.cdr, STAT_CAPS.cdr + 15, 100].map(
      (cdr) => computeAdvisorPipeline(inputWithCdr(cdr)).fuseSecs,
    );

    for (const fuse of fuses) expect(fuse).toBeGreaterThanOrEqual(FUSE_FLOOR);
    for (let i = 1; i < fuses.length; i += 1) expect(fuses[i]).toBeLessThanOrEqual(fuses[i - 1]);
  });

  it('sits at the floor from the cooldown cap upward and does not fall further', () => {
    const atCap = computeAdvisorPipeline(inputWithCdr(STAT_CAPS.cdr));
    const aboveCap = computeAdvisorPipeline(inputWithCdr(STAT_CAPS.cdr + 15));

    expect(atCap.fuseSecs).toBe(FUSE_FLOOR);
    expect(aboveCap.fuseSecs).toBe(FUSE_FLOOR);
    expect(aboveCap.fuseSecs).toBe(atCap.fuseSecs);
    expect(atCap.fuseAtFloor).toBe(true);
    expect(aboveCap.fuseAtFloor).toBe(true);
  });

  it('does not claim the floor is in effect below the cooldown cap', () => {
    const out = computeAdvisorPipeline(inputWithCdr(0));

    expect(out.fuseSecs).toBeGreaterThan(FUSE_FLOOR);
    expect(out.fuseAtFloor).toBe(false);
  });
});
