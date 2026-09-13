import type { TeamPlanCopy } from './index';

/**
 * Strings that name a screen, a save-export flow, or another surface only one host has. Neither
 * host may render a sentence about a surface it does not have, so each supplies these from its own
 * dictionary rather than the package guessing a wording that fits both.
 */
export type TeamPlanHostCopy = {
  /** The empty-state panel shown with no roster imported — a save-export flow the desktop has
   *  no equivalent of. */
  teamPlanEmptyNoRosterTitle: string;
  teamPlanEmptyNoRosterBody: string;
  /** The empty-state panel shown with heroes but no item inventory. */
  teamPlanEmptyNoInventoryTitle: string;
  teamPlanEmptyNoInventoryBody: string;
  /** The empty-state panel shown when every hero resolves to Leave alone. */
  teamPlanEmptyAllLeaveAloneTitle: string;
  teamPlanEmptyAllLeaveAloneBody: string;
  /** The blocked-run notice's remedy sentence — "re-export your save" is a web-only save flow;
   *  false on the desktop, which has no save to export. The title stays package copy. */
  teamPlanBlockedBody: string;
  /** The remedy shown when gold scoring has no furthest phase to sweep to — points at whichever
   *  screen each host uses to import or re-read the account's `max_phase`. */
  teamPlanObjectiveFarmNeedsMaxPhase: string;
  /** Points a reader at "the Optimizer page" from the farm advisor — a cross-screen pointer whose
   *  wording depends on what the host calls that screen and whether it draws this sentence at
   *  all. */
  teamPlanFarmAdvisorPointer: string;
};

/** A key present in both the package dictionary and the host contract would let a host silently
 *  shadow a package string instead of failing the build — this assertion turns that into a
 *  compile error naming the offending key via `never`. */
type HostKeysAreDisjoint = keyof TeamPlanHostCopy & keyof TeamPlanCopy extends never ? true : never;
const _disjoint: HostKeysAreDisjoint = true;
void _disjoint;
