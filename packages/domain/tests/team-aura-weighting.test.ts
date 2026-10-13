/**
 * Every team aura is weighted the same way over a rotation: each carrier present for its own duty
 * cycle, the capped sum taken inside the expectation — whether the aura lands on the sheet (Grito),
 * on gold (Fortuna) or on XP (Aprendiz), and however the House rations its recovery slots.
 */
import { describe, expect, it } from 'vitest';
import {
  computeFarmRateRow,
  computeSquadFarmFacts,
  FORTUNA_AURA_CAP,
  type HeroFarmFacts,
  type SquadFarmAccount,
} from '@bombfarm/domain/farm-rate';
import { FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { APPRENTICE_XP_CAP, TEAM_BUFF_CAP, computeTeamBuffsOverRotation } from '@bombfarm/domain/team-buffs';

function carrier(id: string, uptime: number, rank: number): HeroFarmFacts {
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
    plantsPerSec: 0.5 + uptime,
    blocksPerBomb: 1.5,
    uptime,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: rank,
    apprenticeRank: rank,
    degenerate: false,
  };
}

function account(houseSlots: number): SquadFarmAccount {
  return {
    slots: houseSlots,
    fieldSlots: 1000,
    tree: { danoTotal: 1, critChance: 0, critDmg: 0, speed: 0, energy: 0, teamCoinPct: 0, luckFlatPct: 0, xpMult: 1 },
  };
}

const ROTATIONS: readonly { name: string; carriers: readonly [number, number][] }[] = [
  { name: 'one rank-10 carrier on the field 60% of the time', carriers: [[0.6, 10]] },
  { name: 'two rank-20 carriers at 50% and 30%', carriers: [[0.5, 20], [0.3, 20]] },
  { name: 'a rank-20 and a rank-8 carrier at 70% and 40%', carriers: [[0.7, 20], [0.4, 8]] },
];

describe('one weighting for every team aura', () => {
  for (const rotation of ROTATIONS) {
    it(`${rotation.name}: Grito, Fortuna and Aprendiz reach the same share of their cap`, () => {
      const heroes = rotation.carriers.map(([uptime, rank], index) => carrier(`h${index}`, uptime, rank));
      const grito = computeTeamBuffsOverRotation(
        rotation.carriers.map(([, rank]) => ({ abilities: { grito_guerra: rank } })),
        rotation.carriers.map(([uptime]) => uptime),
      ).grito_guerra;
      const squad = computeSquadFarmFacts(heroes, account(1000));
      const share = grito / TEAM_BUFF_CAP.grito_guerra;
      expect(squad.fortunaAura / FORTUNA_AURA_CAP).toBeCloseTo(share, 12);
      expect((squad.apprenticeXpMult - 1) / APPRENTICE_XP_CAP).toBeCloseTo(share, 12);
    });
  }

  it('a House that rations its slots does not move Fortuna off the shared weighting', () => {
    const heroes = [carrier('a', 0.5, 20), carrier('b', 0.3, 20)];
    const free = computeFarmRateRow(171, computeSquadFarmFacts(heroes, account(1000)));
    const rationed = computeFarmRateRow(171, computeSquadFarmFacts(heroes, account(0.5)));
    expect(rationed?.heroesOnField).toBeLessThan(free?.heroesOnField ?? 0);
    expect(rationed?.fortunaAura).toBe(free?.fortunaAura);
    expect(rationed?.apprenticeXpMult).toBe(free?.apprenticeXpMult);
  });
});
