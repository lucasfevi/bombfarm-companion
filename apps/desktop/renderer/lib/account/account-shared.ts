/**
 * `AccountRoster` → the account-wide block `@bombfarm/domain`'s per-hero maths takes. Pure, no
 * React import.
 *
 * The farm board reaches the same shape through `FarmInputs`, because everything it computes is
 * bounded by the two controls that record carries. A screen that only reads one hero at a time has
 * no rotation pool and no return-bonus mode to state, so it composes the block directly from the
 * roster instead of inventing farm controls to get at it.
 *
 * The block carries no team-aura total. A per-hero screen prices each hero from its own seat —
 * its own aura always, the rest of the roster's through the screen's switches — so the total is
 * overlaid per hero by {@link accountAroundHero}, over the one block every hero shares.
 *
 * Nothing here fills a missing value with a default: there is no `DEFAULT_TREE()` in
 * `apps/desktop` and there must not be one, so an account whose skill tree or House was not read
 * yields `null` and the panels derived from it withhold, rather than printing a plausible-looking
 * number from an invented one.
 */
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { computeTeamBuffsAroundHero, type TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import type { AccountRoster } from './account-roster';

export type AccountBlock = Omit<AccountShared, 'teamBuffs'>;

export function buildAccountBlock(roster: AccountRoster): AccountBlock | null {
  const { account } = roster;
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

/** The block with ONE hero's team-aura total overlaid — the account that hero's figures compute
 *  against (`computeTeamBuffsAroundHero`). */
export function accountAroundHero(
  block: AccountBlock,
  hero: Pick<HeroRecord, 'id' | 'abilities'>,
  roster: readonly Pick<HeroRecord, 'id' | 'abilities' | 'battleAllowed'>[],
  switches: TeamAuraSwitches,
): AccountShared {
  return { ...block, teamBuffs: computeTeamBuffsAroundHero(hero, roster, switches) };
}
