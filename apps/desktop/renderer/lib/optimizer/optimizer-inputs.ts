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
import { canonicalStringify } from '@bombfarm/contracts';
import type { AccountView } from '@bombfarm/contracts';
import type { TeamPlanInputs } from '@bombfarm/team-plan/core';
import { isSectionUsable, sectionFidelityOf } from '../account/account-facts';
import { buildAccountRoster } from '../account/account-roster';
import { heroContentStamp, inventoryContentStamp } from './content-stamp';

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

/**
 * `null` when the record must not be built at all. Nothing here ever fills a missing value with a
 * default: there is no `DEFAULT_TREE()` in `apps/desktop` and there must not be one, so a missing
 * input withholds the whole record rather than producing a plausible-looking plan from an invented
 * one.
 */
export function buildOptimizerInputs(
  view: AccountView,
  farmChosenPhase: number | null,
): TeamPlanInputs | null {
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

  const heroes = roster.heroes.map((hero) => ({ ...hero, updatedAt: heroContentStamp(hero) }));

  return {
    heroes,
    inventory: {
      version: 1,
      importedAt: inventoryContentStamp(roster.inventory),
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
  };
}

/**
 * A value identity over everything the refresh control answers "has the live account moved past
 * the snapshot" from — the flat record with `farmChosenPhase` stripped (D-4: a Farm phase change
 * alone must not read as "the account moved", it reaches the plan through the package signature
 * instead). Heroes arrive already mapped through {@link heroContentStamp} by
 * {@link buildOptimizerInputs}, so this key moves exactly when a hero's content does, never on a
 * poll that only advanced the capture clock.
 */
export function optimizerDepKey(inputs: TeamPlanInputs): string {
  const { farmChosenPhase: _farmChosenPhase, ...rest } = inputs;
  return canonicalStringify(rest);
}
