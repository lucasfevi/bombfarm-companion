import type {
  ApplyCallKind,
  ApplyConflictReason,
  ApplySkipReason,
  ApplyStartReason,
  ApplyStopReason,
} from '@bombfarm/contracts';
import { formatElapsed } from '@bombfarm/team-plan/model';
import { sub, type Copy, type CopyKey } from '../copy';

/** The row's pre-press reasons: the contracts' conflict reasons plus two the row adds — a hero
 *  the live wallet cannot cover, and (the forge row's own) a piece already at its target. */
export type RowSkipReason = ApplyConflictReason | 'notEnoughGold' | 'forgeAtTarget';

/** One call's worth of what the modal's ledger line and in-flight card print — resolved once, at
 *  confirm time, from the live account, and frozen for the run (a later read cannot rename it). */
export type ApplyUnitLabel = {
  readonly index: number;
  readonly call: ApplyCallKind;
  readonly subject: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly points: number | null;
  readonly gold: number;
};

/** Every `ApplySkipReason` (`@bombfarm/contracts`) — a new reason is a compile error. Read by the
 *  modal's skip list and the row's done-state "Show". */
export const APPLY_SKIP_REASON_COPY_KEY = {
  heroLevel: 'applySkipHeroLevel',
  itemMissing: 'applySkipItemMissing',
  itemMoved: 'applySkipItemMoved',
  heroMissing: 'applySkipHeroMissing',
  allocationChanged: 'applySkipAllocationChanged',
  notEnoughGold: 'applySkipNotEnoughGold',
  resetNotPlaced: 'applySkipResetNotPlaced',
  alreadyDone: 'applySkipAlreadyDone',
} as const satisfies Record<ApplySkipReason, CopyKey>;

/** The row's own pre-press reasons — the four conflict reasons plus the two the row adds. */
export const APPLY_ROW_SKIP_REASON_COPY_KEY = {
  itemMissing: 'applySkipItemMissing',
  heroMissing: 'applySkipHeroMissing',
  itemMoved: 'applySkipItemMoved',
  allocationChanged: 'applySkipAllocationChanged',
  notEnoughGold: 'applySkipNotEnoughGold',
  forgeAtTarget: 'applySkipForgeAtTarget',
} as const satisfies Record<RowSkipReason, CopyKey>;

/** Every `ApplyStopReason` but `finished` — a run that finished has no stop reason to show.
 *  `refused`'s value carries a `{code}` placeholder; the caller interpolates it. */
export const APPLY_STOP_REASON_COPY_KEY = {
  stopped: 'applyStopStopped',
  unauthorized: 'applyStopUnauthorized',
  network: 'applyStopNetwork',
  game_not_running: 'applyStopGameNotRunning',
  consent_revoked: 'applyStopConsentRevoked',
  refused: 'applyStopRefused',
} as const satisfies Record<Exclude<ApplyStopReason, 'finished'>, CopyKey>;

/** Main's refusal to start a step, in the player's terms — the fixture and the switch reuse the
 *  Forge tab's own wording (`forgeStartRefusalText`'s shape); the rest are apply-only. */
export function applyStartRefusalText(reason: ApplyStartReason, t: Copy): string {
  switch (reason) {
    case 'busy':
      return t.forgeStartBusy;
    case 'bad_request':
      return t.applyStartBadRequest;
    case 'offline':
      return t.applyStartOffline;
    case 'not_consented':
      return t.forgeStartNotConsented;
    case 'game_not_running':
      return t.forgeStartGameNotRunning;
    case 'token_unavailable':
      return t.forgeStartTokenUnavailable;
    case 'writes_disabled':
      return sub(t.forgeReasonSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'nothing_to_apply':
      return t.applyStartNothing;
    case 'unavailable':
      return t.forgeStartUnavailable;
  }
}

/** `m:ss` (or bare seconds under a minute) for elapsed time, "about T" and the cooldown
 *  countdown — the optimizing modal's own formatter, reused rather than re-implemented. */
export const formatClock = formatElapsed;

/** The modal's in-flight card text for one call. */
export function unitCardText(unit: ApplyUnitLabel, t: Copy): string {
  switch (unit.call) {
    case 'equip':
      return unit.from === null
        ? sub(t.applyModalCallEquipFromBag, { item: unit.subject, to: unit.to ?? '' })
        : sub(t.applyModalCallEquip, { from: unit.from, item: unit.subject, to: unit.to ?? '' });
    case 'unequip':
      return sub(t.applyModalCallUnequip, { item: unit.subject });
    case 'respec':
      return sub(t.applyModalCallRespec, { hero: unit.subject, points: unit.points ?? 0 });
    case 'commit':
      return sub(t.applyModalCallCommit, { hero: unit.subject, points: unit.points ?? 0 });
  }
}
