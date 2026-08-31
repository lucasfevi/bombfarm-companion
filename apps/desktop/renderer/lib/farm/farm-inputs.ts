/**
 * `AccountView` → the flat `FarmInputs` record `@bombfarm/farm/core` computes the farm board
 * from. Pure, no React import — and the one place `parseAccountPayload` is called on the desktop.
 * It is called from the RENDERER on purpose: main detects that the account changed, the renderer
 * is what recomputes from it, and a structural guard fails the build if that identifier ever
 * appears under `apps/desktop/src/main`.
 */
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { isTrustworthySection } from '@bombfarm/contracts';
import type { AccountPayload, AccountSection, AccountView, SectionFidelity } from '@bombfarm/contracts';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { FarmInputs } from '@bombfarm/farm/core';

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
 * The withhold gate is per-section usability, never the account-wide fidelity grade. A
 * `degraded` section is usable only when `isTrustworthySection` says its body lost nothing.
 */
export function isSectionUsable(fidelity: SectionFidelity): boolean {
  if (fidelity.status === 'degraded') return isTrustworthySection(fidelity);
  return fidelity.status === 'resolved' || fidelity.status === 'stale';
}

function sectionFidelityOf(payload: AccountPayload, section: AccountSection): SectionFidelity {
  // No fidelity block for a section reads as `missing` — the conservative, withhold-safe default.
  // It differs from `deriveAccountFidelity`'s own "absent fidelity ⇒ grade full" rule, which
  // exists for the web's direct-file import where every section is present by construction; an
  // `AccountView` always carries a real fidelity block, so this branch is defensive only.
  return payload.fidelity?.[section] ?? { status: 'missing' };
}

function capturedAtOf(payload: AccountPayload, section: AccountSection): string | null {
  const fidelity = sectionFidelityOf(payload, section);
  return fidelity.status === 'missing' ? null : fidelity.capturedAt;
}

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
