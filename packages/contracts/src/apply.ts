/**
 * The apply-a-plan IPC seam: the units the renderer derives from a `TeamPlan`, the request that
 * starts a step, and the closed event union a run pushes while it spends the player's gold and
 * time. `ApplyUnitVerdict` is the preflight's own answer shape — read by the renderer over its
 * live account view and re-derived by main against its own cache; there is no `apply:preflight`
 * channel.
 */

export type ApplyStep = 'equip' | 'points';
export type ApplyCallKind = 'equip' | 'unequip' | 'respec' | 'commit';

export type CommitVector = readonly [number, number, number, number, number, number, number, number];

/** A hero id, or `null` for the bag. */
export type ApplyLocation = string | null;

export interface ApplyEquipUnit {
  readonly index: number;
  readonly call: 'equip' | 'unequip';
  readonly itemId: string;
  readonly defId: string;
  readonly slot: string;
  readonly fromHeroId: string | null;
  readonly toHeroId: string | null;
  readonly displacesItemId: string | null;
  readonly freedByIndex: number | null;
  readonly pendingAt: readonly ApplyLocation[];
  readonly doneAt: readonly ApplyLocation[];
}

export interface ApplyPointsUnit {
  readonly index: number;
  readonly heroId: string;
  readonly level: number;
  readonly needsRespec: boolean;
  readonly respecGold: number;
  readonly vectorBefore: CommitVector;
  readonly vector: CommitVector;
  readonly pointsPlaced: number;
}

export type ApplyConflictReason = 'itemMissing' | 'heroMissing' | 'itemMoved' | 'allocationChanged';
export type ApplyVerdictStatus = 'pending' | 'pendingFull' | 'pendingCommit' | 'done' | 'conflict';

export interface ApplyUnitVerdict {
  readonly index: number;
  readonly status: ApplyVerdictStatus;
  readonly reason?: ApplyConflictReason;
}

export type ApplyStartRequest =
  | { readonly step: 'equip'; readonly planRunId: string; readonly units: readonly ApplyEquipUnit[] }
  | { readonly step: 'points'; readonly planRunId: string; readonly units: readonly ApplyPointsUnit[] };

export type ApplyStartReason =
  | 'busy'
  | 'bad_request'
  | 'offline'
  | 'not_consented'
  | 'game_not_running'
  | 'token_unavailable'
  | 'writes_disabled'
  | 'nothing_to_apply'
  | 'unavailable';

export type ApplyStartResult = { readonly ok: true; readonly runId: string } | { readonly ok: false; readonly reason: ApplyStartReason };

export type ApplySkipReason =
  | 'heroLevel'
  | 'itemMissing'
  | 'itemMoved'
  | 'heroMissing'
  | 'allocationChanged'
  | 'notEnoughGold'
  | 'resetNotPlaced'
  | 'alreadyDone';

export type ApplyUnitStatus = 'sent' | 'ok' | 'skipped' | 'failed';

export interface ApplyUnitEvent {
  runId: string;
  step: ApplyStep;
  index: number;
  status: ApplyUnitStatus;
  call?: ApplyCallKind;
  reason?: ApplySkipReason;
  code?: string;
  goldSpent?: number;
  walletAfter?: number | null;
}

export interface ApplyCooldownEvent {
  runId: string;
  step: ApplyStep;
  index: number;
  resumeAtMs: number;
}

export interface ApplyResumedEvent {
  runId: string;
  step: ApplyStep;
  index: number;
}

export type ApplyStopReason =
  | 'finished'
  | 'stopped'
  | 'unauthorized'
  | 'network'
  | 'game_not_running'
  | 'consent_revoked'
  | 'refused';

export interface ApplySkip {
  index: number;
  reason: ApplySkipReason;
  code?: string;
}

export interface ApplyFailed {
  index: number;
  call: ApplyCallKind;
  code: string | null;
  resetDone: boolean;
}

export interface ApplyRunResult {
  step: ApplyStep;
  total: number;
  made: number;
  skipped: ApplySkip[];
  failed: ApplyFailed | null;
  stop: ApplyStopReason;
  stopCode: string | null;
  goldSpent: number;
  durationMs: number;
}

export interface ApplyDoneEvent {
  runId: string;
  step: ApplyStep;
  result: ApplyRunResult;
}

export type ApplyEvent =
  | ({ type: 'unit' } & ApplyUnitEvent)
  | ({ type: 'cooldown' } & ApplyCooldownEvent)
  | ({ type: 'resumed' } & ApplyResumedEvent)
  | ({ type: 'done' } & ApplyDoneEvent);

/** Test-only: arms a scripted run that the next `apply:start` replays with `gapMs` between events. */
export interface ApplyInjectRequest {
  readonly runId: string;
  readonly events: readonly ApplyEvent[];
  readonly gapMs: number;
}

const APPLY_STEPS: readonly ApplyStep[] = ['equip', 'points'];
const APPLY_UNIT_STATUSES: readonly ApplyUnitStatus[] = ['sent', 'ok', 'skipped', 'failed'];
const APPLY_STOP_REASONS: readonly ApplyStopReason[] = [
  'finished',
  'stopped',
  'unauthorized',
  'network',
  'game_not_running',
  'consent_revoked',
  'refused',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isLocationArray(value: unknown): value is readonly ApplyLocation[] {
  return Array.isArray(value) && value.every(isNullableString);
}

export function isCommitVector(value: unknown): value is CommitVector {
  return (
    Array.isArray(value) &&
    value.length === 8 &&
    value.every((entry) => typeof entry === 'number' && Number.isSafeInteger(entry) && entry >= 0)
  );
}

export function isApplyEquipUnit(value: unknown): value is ApplyEquipUnit {
  if (!isRecord(value)) return false;
  if (!isNonNegativeInteger(value.index)) return false;
  if (value.call !== 'equip' && value.call !== 'unequip') return false;
  if (!isNonEmptyString(value.itemId) || !isNonEmptyString(value.defId) || !isNonEmptyString(value.slot)) return false;
  if (!isNullableString(value.fromHeroId) || !isNullableString(value.toHeroId)) return false;
  if (!isNullableString(value.displacesItemId)) return false;
  if (value.freedByIndex !== null && !isNonNegativeInteger(value.freedByIndex)) return false;
  if (!isLocationArray(value.pendingAt) || !isLocationArray(value.doneAt)) return false;
  return true;
}

export function isApplyPointsUnit(value: unknown): value is ApplyPointsUnit {
  if (!isRecord(value)) return false;
  if (!isNonNegativeInteger(value.index)) return false;
  if (!isNonEmptyString(value.heroId)) return false;
  if (!isFiniteNumber(value.level)) return false;
  if (typeof value.needsRespec !== 'boolean') return false;
  if (!isFiniteNumber(value.respecGold) || value.respecGold < 0) return false;
  if (!isCommitVector(value.vectorBefore) || !isCommitVector(value.vector)) return false;
  if (!isFiniteNumber(value.pointsPlaced)) return false;
  return true;
}

export function isApplyStartRequest(value: unknown): value is ApplyStartRequest {
  if (!isRecord(value)) return false;
  if (typeof value.planRunId !== 'string' || value.planRunId.length === 0) return false;
  if (!Array.isArray(value.units)) return false;
  if (value.step === 'equip') return value.units.every(isApplyEquipUnit);
  if (value.step === 'points') return value.units.every(isApplyPointsUnit);
  return false;
}

function isApplyUnitEventShape(value: Record<string, unknown>): boolean {
  return isNonNegativeInteger(value.index) && APPLY_UNIT_STATUSES.includes(value.status as ApplyUnitStatus);
}

function isApplyCooldownEventShape(value: Record<string, unknown>): boolean {
  return isNonNegativeInteger(value.index) && isFiniteNumber(value.resumeAtMs);
}

function isApplyResumedEventShape(value: Record<string, unknown>): boolean {
  return isNonNegativeInteger(value.index);
}

function isApplyDoneEventShape(value: Record<string, unknown>): boolean {
  if (!isRecord(value.result)) return false;
  const result = value.result;
  return (
    APPLY_STOP_REASONS.includes(result.stop as ApplyStopReason) &&
    isNonNegativeInteger(result.made) &&
    isNonNegativeInteger(result.total)
  );
}

export function isApplyEvent(value: unknown): value is ApplyEvent {
  if (!isRecord(value)) return false;
  if (typeof value.runId !== 'string' || value.runId.length === 0) return false;
  if (!APPLY_STEPS.includes(value.step as ApplyStep)) return false;
  switch (value.type) {
    case 'unit':
      return isApplyUnitEventShape(value);
    case 'cooldown':
      return isApplyCooldownEventShape(value);
    case 'resumed':
      return isApplyResumedEventShape(value);
    case 'done':
      return isApplyDoneEventShape(value);
    default:
      return false;
  }
}

export function isApplyInjectRequest(value: unknown): value is ApplyInjectRequest {
  if (!isRecord(value)) return false;
  if (typeof value.runId !== 'string' || value.runId.length === 0) return false;
  if (!isFiniteNumber(value.gapMs) || value.gapMs < 0) return false;
  if (!Array.isArray(value.events)) return false;
  return value.events.every(isApplyEvent);
}
