import { parseSaveFile } from '@bombfarm/domain/import-save';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import type { TeamPlanHeroInput, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { assertInRegime } from './capture-regime';
import { loadFixtureJson } from './sheet-math-fixtures';

/**
 * The in-regime roster for the team-plan suites (issue #206).
 *
 * The two captures these suites used to read are behind the importer's stat-point budget refusal,
 * and the damage is not subtle: `payload-20260812-8heroes.json` loses half its roster (8 heroes
 * in, 4 unblocked out) and every one of the survivors comes through with an EMPTY loadout, so a
 * gear planner was being exercised on a roster wearing nothing. `save-20260813-5heroes.json` is
 * the same story at 5 -> 3. That is what the disabled tests in this group were recording: no
 * donor to take an item from, no forge candidate, no pair of point resets to order.
 *
 * This capture comes through 7 of 7 unblocked with 40 items worn across 5 heroes and 54 in the
 * bag — a plan needs items to keep, move and forge, and it has them. Picked over the two larger
 * in-regime captures, which are equally well geared, because it is a different ACCOUNT from the
 * rest of the corpus and because the solver runs an order of magnitude faster on 7 heroes than on
 * 11 or 13, across a group of suites that call it dozens of times.
 */
export const TEAM_PLAN_FIXTURE = 'save-20260819-11882-7heroes.json';

/**
 * The larger in-regime roster, for the two claims the 7-hero one cannot carry: it produces five
 * point resets where the smaller produces one, so anything asserting an ORDER over resets needs
 * this one.
 */
export const TEAM_PLAN_LARGE_FIXTURE = 'save-20260825-11heroes-one-shot-spread.json';

// Asserted once here rather than repeated in each of the seven suites that read these two: the
// constants are the single point where the choice of capture is made, so this is the single point
// where it can be wrong. Throws rather than skips — a value suite pointed at an expired capture
// should fail loudly, not report a green run with a quiet skip in it.
for (const fixture of [TEAM_PLAN_FIXTURE, TEAM_PLAN_LARGE_FIXTURE]) {
  assertInRegime(`sheet-math/${fixture}`, 'sheet');
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
