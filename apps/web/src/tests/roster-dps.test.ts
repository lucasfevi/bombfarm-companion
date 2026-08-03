/**
 * Regression for the roster-dps ↔ Points tab drift: `pipelineForHero` must forward
 * `hero.birth` to `computeAdvisorPipeline`, the same way `selectAdvisorPipeline` forwards
 * `state.birth` (advisor-selectors.ts). Before this fix, `listHeroesWithResetAdvice` /
 * `computeHeroSoloDps` / `rankRosterByDps` evaluated stored `naked`/`gearedOverride` while
 * the Points tab evaluated birth-recomposed sheets — same hero, two different answers,
 * exactly the drift `6fcc9cc` fixed for the planner store.
 */
import { describe, expect, it } from 'vitest';
import { computeHeroSoloDps, listHeroesWithResetAdvice } from '@bombfarm/domain/roster-dps';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { emptyLoadout, type SheetStats } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import {
  DEFAULT_CONTEXT,
  DEFAULT_TREE,
  type AccountShared,
  type HeroRecord,
} from '@/shared/lib/storage';

const sampleBirth = (): SheetStats => ({
  attack: 200,
  energy: 400,
  speed: 55,
  critChance: 10,
  critDmg: 80,
  penetration: 5,
  cdr: 4,
  luck: 15,
});

describe('pipelineForHero forwards birth (roster-dps ↔ Points tab parity)', () => {
  const birth = sampleBirth();
  const level = 61;
  const stars = 1;
  const loadout = emptyLoadout();
  const pts = { ...ZERO_PTS(), attack: 56, energy: 1, critDmg: 4 };
  // Deliberately-wrong stored naked/gearedOverride — a stale residual snapshot from before a
  // level/stars edit. If pipelineForHero ignored birth, roster DPS would follow these instead.
  const staleNaked = { ...birth, attack: birth.attack * 2 };
  const staleGeared = { ...birth, attack: birth.attack * 2.5 };

  const hero: HeroRecord = {
    id: 'h1',
    name: 'Hero',
    updatedAt: 1,
    rarity: 'Raro',
    level,
    stars,
    naked: staleNaked,
    loadout,
    altLoadout: null,
    gearedOverride: staleGeared,
    abilities: {},
    pts,
    birth,
  };

  const account: AccountShared = {
    tree: { ...DEFAULT_TREE(), danoTotal: 1.78324567735483 },
    teamBuffs: zeroTeamBuffs(),
    context: {
      ...DEFAULT_CONTEXT(),
      houseIdx: 0,
      houseLevel: 1,
      phase: 1,
      mitigationPct: 6.7,
      rankMode: 'dps',
      targetProp: 'stone',
    },
  };
  const phase = 1;
  const mitigationPct = 6.7;

  function directPipeline(withBirth: boolean) {
    return computeAdvisorPipeline({
      naked: staleNaked,
      geared: staleGeared,
      loadout,
      altLoadout: null,
      pts,
      abilities: {},
      rarity: 'Raro',
      level,
      stars,
      treeDanoTotal: account.tree.danoTotal,
      treeCritChance: account.tree.critChance,
      treeCritDmg: account.tree.critDmg,
      treeSpeed: account.tree.speed,
      treeEnergy: account.tree.energy,
      treeGlassCannon: account.tree.glassCannon,
      treeTempoDobrado: account.tree.tempoDobrado,
      treeLuckFlatPct: account.tree.luckFlatPct ?? 0,
      teamBuffs: account.teamBuffs,
      houseIdx: account.context.houseIdx,
      houseLevel: account.context.houseLevel,
      phase,
      mitigationPct,
      rankMode: account.context.rankMode,
      targetProp: account.context.targetProp,
      ...(withBirth ? { birth } : {}),
    });
  }

  it('computeHeroSoloDps matches a direct computeAdvisorPipeline call given the same inputs plus birth', () => {
    const rosterDps = computeHeroSoloDps(hero, account, phase, mitigationPct);
    const withBirth = directPipeline(true);
    expect(rosterDps).toBe(withBirth.dps);

    // Prove birth is actually driving the number, not merely accepted and ignored: dropping
    // birth (falling back to the stale stored naked/gearedOverride) must disagree.
    const withoutBirth = directPipeline(false);
    expect(rosterDps).not.toBe(withoutBirth.dps);
  });

  it("listHeroesWithResetAdvice's roster membership agrees with the birth-backed pipeline's own resetAdvice.recommend", () => {
    const withBirth = directPipeline(true);
    const rosterRows = listHeroesWithResetAdvice([hero], account, phase, mitigationPct);
    const inRoster = rosterRows.some((row) => row.heroId === hero.id);
    expect(inRoster).toBe(withBirth.resetAdvice.recommend);
  });
});
