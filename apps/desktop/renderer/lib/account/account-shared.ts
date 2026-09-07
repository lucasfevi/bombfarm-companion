/**
 * `AccountRoster` → the account-wide block `@bombfarm/domain`'s per-hero maths takes. Pure, no
 * React import.
 *
 * The farm board reaches the same shape through `FarmInputs`, because everything it computes is
 * bounded by the two controls that record carries. A screen that only reads one hero at a time has
 * no rotation pool and no return-bonus mode to state, so it composes the block directly from the
 * roster instead of inventing farm controls to get at it.
 *
 * Nothing here fills a missing value with a default: there is no `DEFAULT_TREE()` in
 * `apps/desktop` and there must not be one, so an account whose skill tree or House was not read
 * yields `null` and the panels derived from it withhold, rather than printing a plausible-looking
 * number from an invented one.
 */
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import type { AccountShared } from '@bombfarm/domain/shims/storage';
import type { AccountRoster } from './account-roster';

export function buildAccountShared(roster: AccountRoster): AccountShared | null {
  const { heroes, account } = roster;
  const { tree, houseIdx, houseLevel } = account;
  if (tree === null || houseIdx === null || houseLevel === null) return null;

  return {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      luckFlatPct: tree.luckFlatPct,
    },
    // Always derived from this same roster, never an override: there is no team-buffs UI on the
    // desktop, so there is nothing for an override to record.
    teamBuffs: computeTeamBuffsFromDeployed(heroes),
    teamBuffsOverride: null,
    // `phase` and `mitigationPct` are the caller's, passed per call: this block is shared by every
    // hero on the screen and must not carry one hero's stage.
    context: {
      houseIdx,
      houseLevel,
      phase: null,
      mitigationPct: 1,
      rankMode: 'dps',
      targetProp: 'stone',
    },
    // Spread rather than assigned: `AccountShared.slots` is optional-and-absent, never explicitly
    // undefined, so an account with no House slots figure must omit the key rather than set it.
    ...(account.slots === undefined || account.slots === null ? {} : { slots: account.slots }),
    fieldSlots: account.fieldSlots ?? null,
    houseCycleSecs: account.houseCycleSecs ?? null,
    // The payload carries no anchor for the cycle measurement and needs none: the measured cycle
    // and the House configuration come out of the SAME read, so the anchor IS the live value.
    houseCycleSecsHouseIdx: houseIdx,
    houseCycleSecsLevel: houseLevel,
    maxPhase: account.maxPhase ?? null,
  };
}
