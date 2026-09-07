/**
 * `AccountView` → the flat `FarmInputs` record `@bombfarm/farm/core` computes the farm board
 * from. Pure, no React import. `parseAccountPayload` is called from the RENDERER on purpose: main
 * detects that the account changed, the renderer is what recomputes from it, and a structural
 * guard fails the build if that identifier ever appears under `apps/desktop/src/main`.
 *
 * The per-section usability gate and the capture-time reads are `lib/account/account-facts.ts`'s,
 * imported rather than restated — the Account screen gates on the same rule, per panel.
 */
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { canonicalStringify } from '@bombfarm/contracts';
import type { AccountView } from '@bombfarm/contracts';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { readFarmDepTuple, type FarmInputs } from '@bombfarm/farm/core';
import { capturedAtOf, isSectionUsable, sectionFidelityOf } from '../account/account-facts';

// Re-exported, never redefined: the board's withhold gate IS that rule, and this module stays the
// seam its own tests ask for it through.
export { isSectionUsable };

/**
 * The two compute inputs the player owns. Everything else on {@link FarmInputs} is read out of
 * the account; these two are chosen on the screen, and changing either is one of the three
 * events allowed to recompute the board. Filters, sorting and phase selection are not here
 * because they are post-compute and must never invalidate a snapshot.
 */
export type FarmControls = {
  readonly farmPoolOverrides: Record<string, boolean>;
  readonly farmReturnBonus: ReturnBonusMode;
};

/** One shared reference, so a screen that never touched the controls hands the compute the same
 *  object every time — `farmPoolOverrides` is compared by identity inside the package. */
export const DEFAULT_FARM_CONTROLS: FarmControls = Object.freeze({
  farmPoolOverrides: Object.freeze({}) as Record<string, boolean>,
  farmReturnBonus: 'off' as const,
});

/**
 * `null` when the board must not be computed at all. Nothing here ever fills a missing value
 * with a default: there is no `DEFAULT_TREE()` in `apps/desktop` and there must not be one, so a
 * missing input withholds the whole board rather than producing a plausible-looking number from
 * an invented one.
 */
export function buildFarmInputs(view: AccountView, controls: FarmControls): FarmInputs | null {
  const payload = view.payload;

  // `existing` is `[]`: the desktop keeps no local roster, so `matchedExistingId` is always
  // `null` and `isGearRefresh` always `false`.
  const parsed = parseAccountPayload(payload, []);
  if (parsed.rejected !== null) return null;

  // Every number the board prints is DPS-derived, so all five sections feed it: `heroes` and
  // `items` build the hero sheets, `skills`, `casa` and `account` the account-wide state around
  // them. Trusting a section's mere presence over the fidelity status it was asserted under is
  // exactly the labelled-wrong-number hazard the per-section gate exists to forbid — the status
  // is authoritative, not the raw payload.
  if (!ACCOUNT_SECTIONS.every((section) => isSectionUsable(sectionFidelityOf(payload, section)))) {
    return null;
  }

  const heroesCapturedAt = capturedAtOf(payload, 'heroes');
  const heroUpdatedAt = heroesCapturedAt === null ? Date.now() : Date.parse(heroesCapturedAt);

  // Candidate completion is the only synthesis performed. `parseAccountPayload` returns records
  // missing exactly two fields: `id` is the game's own stable hero id, and `updatedAt` is the
  // heroes section's own capture time. No stat is ever synthesised.
  const heroes: HeroRecord[] = parsed.candidates.map((candidate) => ({
    ...candidate.record,
    id: candidate.sourceId,
    updatedAt: heroUpdatedAt,
  }));

  const tree = parsed.account.tree;
  const houseIdx = parsed.account.houseIdx;
  const houseLevel = parsed.account.houseLevel;
  if (tree === null || houseIdx === null || houseLevel === null) return null;

  return {
    heroes,
    treeDanoTotal: tree.danoTotal,
    treeCritChance: tree.critChance,
    treeCritDmg: tree.critDmg,
    treeSpeed: tree.speed,
    treeEnergy: tree.energy,
    treeTeamCoinPct: tree.teamCoinPct ?? 0,
    treeLuckFlatPct: tree.luckFlatPct,
    // Always derived from this same roster, never an override: there is no team-buffs UI on the
    // desktop, so there is nothing for an override to record. A stored zero here would leave
    // every carrier reading zero benefit from its own aura, with no field on screen to correct
    // it.
    effectiveTeamBuffs: computeTeamBuffsFromDeployed(heroes),
    teamBuffsOverride: null,
    houseIdx,
    houseLevel,
    slots: parsed.account.slots ?? undefined,
    fieldSlots: parsed.account.fieldSlots ?? null,
    houseCycleSecs: parsed.account.houseCycleSecs ?? null,
    // The imported account data carries no anchor for the cycle measurement, and on the desktop
    // it does not need one: the measured cycle and the house configuration come out of the SAME
    // payload read, so the anchor IS the live value. Mirroring them keeps the House-rest
    // resolution able to tell a house-picker move from the configuration the measurement was
    // taken at; leaving them null instead makes the measured cycle trusted unconditionally, at
    // whatever house the picker happens to be on.
    houseCycleSecsHouseIdx: houseIdx,
    houseCycleSecsLevel: houseLevel,
    // A compute input, not a post-compute filter: it is what sets each row's `locked`. Left
    // null, every row reads unlocked and the unlocked-only filter silently stops filtering.
    maxPhase: parsed.account.maxPhase ?? null,
    farmPoolOverrides: controls.farmPoolOverrides,
    farmReturnBonus: controls.farmReturnBonus,
  };
}

/**
 * The heroes section's own capture time, copied onto every record by {@link buildFarmInputs} and
 * read by nothing that computes a rate — no `@bombfarm/domain` module reads `updatedAt` at all.
 * It moves on every poll, which is why `accountChangeKey` is `capturedAt`-blind and why the
 * board's own identity below has to be too.
 */
function withoutCaptureTime(hero: HeroRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...hero };
  delete fields.updatedAt;
  return fields;
}

/**
 * A value identity for everything the farm board recomputes from — `readFarmDepTuple`'s
 * nineteen members, compared as values rather than as references.
 *
 * `@bombfarm/farm/core` compares that tuple with `Object.is` and places the matching obligation
 * on the host app: the three object members (`heroes`, `effectiveTeamBuffs`,
 * `farmPoolOverrides`) must keep their identity across a read that changed nothing. This app
 * cannot honour it — {@link buildFarmInputs} re-parses the payload and allocates two of the
 * three afresh on every account read — so it answers the question by value instead.
 */
export function farmBoardDepKey(inputs: FarmInputs): string {
  const [heroes, ...rest] = readFarmDepTuple(inputs);
  return canonicalStringify([heroes.map(withoutCaptureTime), ...rest]);
}
