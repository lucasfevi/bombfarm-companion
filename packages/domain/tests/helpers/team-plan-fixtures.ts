import { parseSaveFile } from '@bombfarm/domain/import-save';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import type { TeamPlanHeroInput, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { holdSuiteUntilInRegime } from './capture-regime';
import { loadFixtureJson } from './sheet-math-fixtures';

/**
 * The in-regime roster for the team-plan suites: the second account, past every boundary.
 *
 * A gear planner needs items to keep, move and forge, and this capture has them — 9 heroes, all
 * importing unblocked, eight of them geared 8/8 with 64 items worn and 37 spares in the bag (with
 * duplicate copies among them), upgrades at 0, 8 and 10 so a floor of 10 leaves real forge
 * chores. The ninth hero is naked with her whole 67-point budget unspent. Chosen over the larger
 * capture below because it is a different ACCOUNT from the rest of the corpus, and because the
 * solver converges in ~3s here against ~8-10s on 20 heroes, across a group of suites that call
 * it dozens of times.
 */
export const TEAM_PLAN_FIXTURE = 'save-20260914-9heroes-second-account.json';

/**
 * The larger in-regime roster: the main account at phase 101, 20 heroes — thirteen geared at
 * L40-L151 beside seven naked ones at L1-L24. The step-monotonicity grid sweeps both files so the
 * invariant is checked on two accounts, and this one is saturated at every slot count the grid
 * visits. It yields six point resets at floor 10 / slots 9, in an acceptance order that is not
 * alphabetical by hero id, which is what an ordering claim needs.
 */
export const TEAM_PLAN_LARGE_FIXTURE = 'save-20260914-20heroes-phase101.json';

/**
 * Held once here rather than repeated in each suite that reads these two: the constants are the
 * single point where the choice of capture is made, so this is the single point where it can be
 * wrong.
 *
 * A hold rather than `assertInRegime`: when the next boundary lands, the corpus may again have
 * nothing a gear planner can be re-pointed at, and a throw here would be a standing red no one
 * can clear. The skip is counted, names the capture and the boundary, and
 * `tools/held-suites.manifest.mjs` must then record the group as held.
 */
export function holdTeamPlanSuiteUntilInRegime(): void {
  for (const fixture of [TEAM_PLAN_FIXTURE, TEAM_PLAN_LARGE_FIXTURE]) {
    holdSuiteUntilInRegime(`sheet-math/${fixture}`, 'sheet');
  }
}

export function teamPlanInputFromFixture(file: string, forgeFloor = 10): TeamPlanInput {
  const raw = loadFixtureJson(file);
  const { inventory, candidates, account } = parseSaveFile(raw, []);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  const heroes: TeamPlanHeroInput[] = candidates
    .filter((c) => !c.blocked)
    .map((c) => ({
      heroId: c.sourceId,
      name: c.name,
      level: c.level,
      stars: c.record.stars,
      rarity: c.rarity,
      birth: c.record.birth,
      abilities: c.record.abilities,
      pts: c.record.pts,
      loadout: c.record.loadout,
      battleAllowed: c.record.battleAllowed,
      statPointsAvailable: c.record.statPointsAvailable,
      runes: c.record.runes,
    }));
  const scopeByHeroId = Object.fromEntries(heroes.map((h) => [h.heroId, 'optimize' as const]));
  return {
    heroes,
    inventory,
    account: {
      treeSheet,
      houseIdx: account.houseIdx ?? 0,
      houseLevel: account.houseLevel ?? 1,
      phase: 1,
      mitigationPct: 6.7,
      slots: account.slots ?? 9,
      fieldSlots: account.fieldSlots ?? account.slots ?? 9,
    },
    scopeByHeroId,
    forgeFloor,
  };
}
