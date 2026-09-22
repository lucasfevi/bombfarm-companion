/**
 * `AccountView` → the package's flat `TeamPlanInputs` record. Pure, no React import, no storage
 * read — the Farm phase the caller wants written into `farmChosenPhase` is a parameter, not
 * something this module goes looking for.
 *
 * The roster and the account-wide block are `lib/account/account-roster.ts`'s, from one parse of
 * the payload shared with every other screen that draws heroes. The per-section usability gate and
 * the capture-time reads are `lib/account/account-facts.ts`'s, imported rather than restated — the
 * Account screen gates on the same rule, per panel. `lib/farm/farm-inputs.ts` is this module's
 * template: same withhold gate, same tree/house/cycle field reads.
 */
import { phaseLine } from '@bombfarm/domain/phases';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import type { AccountView } from '@bombfarm/contracts';
import { planInputsSignature, type TeamPlanInputs } from '@bombfarm/team-plan/core';
import { capturedAtOf, isSectionUsable, sectionFidelityOf } from '../account/account-facts';
import { buildAccountRoster } from '../account/account-roster';

// Re-exported, never redefined: the mapper's withhold gate IS that rule, and this module stays
// the seam its own tests ask for it through.
export { isSectionUsable };

/** The web store's own rounding — see `apps/web/src/shared/stores/slices/account-slice.ts`. A
 *  phase outside the wiki table falls back to a mitigation of 0.01, which lands on the same `1`
 *  a `null` phase reads as. */
export function mitigationPctFor(phase: number | null): number {
  if (phase === null) return 1;
  const line = phaseLine(phase);
  return +((line?.mitig ?? 0.01) * 100).toFixed(2);
}

/** A hero the search left out because the account read could not tell it how many stat points
 *  that hero has spent — named, so the screen can tell the player which ones and why. */
export type OptimizerLeftOutHero = { readonly id: string; readonly name: string };

export type OptimizerInputsResult = {
  readonly inputs: TeamPlanInputs;
  readonly leftOut: readonly OptimizerLeftOutHero[];
};

/**
 * `null` when the record must not be built at all. Nothing here ever fills a missing value with a
 * default: there is no `DEFAULT_TREE()` in `apps/desktop` and there must not be one, so a missing
 * input withholds the whole record rather than producing a plausible-looking plan from an invented
 * one.
 */
export function buildOptimizerInputs(
  view: AccountView,
  farmChosenPhase: number | null,
): OptimizerInputsResult | null {
  const payload = view.payload;

  const roster = buildAccountRoster(view);
  if (roster === null) return null;

  // Every figure the search prints is derived from all five sections, exactly as the farm board
  // is — trusting a section's mere presence over the fidelity status it was asserted under is the
  // labelled-wrong-number hazard the per-section gate exists to forbid.
  if (!ACCOUNT_SECTIONS.every((section) => isSectionUsable(sectionFidelityOf(payload, section)))) {
    return null;
  }

  const account = roster.account;
  const tree = account.tree;
  const houseIdx = account.houseIdx;
  const houseLevel = account.houseLevel;
  if (tree === null || houseIdx === null || houseLevel === null) return null;
  if (typeof account.slots !== 'number' || !Number.isFinite(account.slots)) return null;

  // A hero whose spent points the parser could not recover carries a zeroed `pts` (see
  // `AccountRoster.pointsUnrecovered`), so the search must never see it — it would read as a
  // hero with nothing spent and propose spending it all over again.
  const leftOutIds = new Set(roster.pointsUnrecovered.map((hero) => hero.id));
  const heroes = roster.heroes.filter((hero) => !leftOutIds.has(hero.id));

  const inputs: TeamPlanInputs = {
    heroes,
    inventory: {
      version: 1,
      importedAt: Date.parse(capturedAtOf(payload, 'items') ?? '') || 0,
      items: roster.inventory,
    },
    treeDanoTotal: tree.danoTotal,
    treeEnergy: tree.energy,
    treeSpeed: tree.speed,
    treeCritChance: tree.critChance,
    treeCritDmg: tree.critDmg,
    treeLuckFlatPct: tree.luckFlatPct,
    treeTeamCoinPct: tree.teamCoinPct ?? 0,
    treeXpMult: tree.xpMult ?? 1,
    houseIdx,
    houseLevel,
    phase: account.phase,
    mitigationPct: mitigationPctFor(account.phase),
    slots: account.slots,
    fieldSlots: account.fieldSlots ?? null,
    houseCycleSecs: account.houseCycleSecs ?? null,
    houseCycleSecsHouseIdx: houseIdx,
    houseCycleSecsLevel: houseLevel,
    maxPhase: account.maxPhase ?? null,
    farmChosenPhase,
    // The duel room's phase is live, not part of the account read: the screen merges it in.
    pvpRoomPhase: null,
  };

  return { inputs, leftOut: roster.pointsUnrecovered };
}

/**
 * A value identity over everything the refresh control answers "has the live account moved past
 * the snapshot" from: the package's own planning view of the inputs, which leaves out
 * `farmChosenPhase` (a Farm phase change alone must not read as "the account moved" — it reaches
 * the plan through the package signature instead), the capture clock, and the fields the game
 * moves without moving the answer — a hero walking off the field, a rune's seconds ticking down.
 */
export function optimizerDepKey(inputs: TeamPlanInputs): string {
  return planInputsSignature(inputs);
}
