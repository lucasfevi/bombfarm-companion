/**
 * The deconstruct IPC seam: the request that burns a batch of inventory items for Forge Essence
 * and the one event a run pushes when the server has answered. A batch is a single call, so
 * there is no per-unit progress, only a settled outcome.
 */

/** The game client's own per-call burn cap (build 25733721); the server may lower it. */
export const DECONSTRUCT_BATCH_MAX = 100;

export interface DeconstructStartRequest {
  itemIds: string[];
}

export type DeconstructStartReason =
  | 'busy'
  | 'offline'
  | 'bad_request'
  | 'not_consented'
  | 'game_not_running'
  | 'token_unavailable'
  | 'writes_disabled'
  | 'unknown_item'
  | 'unavailable';

export type DeconstructStartResult =
  | { ok: true; runId: string }
  | { ok: false; reason: DeconstructStartReason };

export type DeconstructFailure = 'cooldown' | 'session' | 'network' | 'unreadable' | 'error';

export type DeconstructRunResult =
  | { status: 'burned'; burned: number; gained: number; essence: number }
  | { status: 'refused'; code: string }
  | { status: 'failed'; reason: DeconstructFailure };

export interface DeconstructDoneEvent {
  type: 'done';
  runId: string;
  itemIds: string[];
  result: DeconstructRunResult;
}

export type DeconstructEvent = DeconstructDoneEvent;

/** Test-only: scripted events replayed through the real `deconstruct:event` seam. */
export interface DeconstructInjectRequest {
  events: DeconstructEvent[];
}

const DECONSTRUCT_FAILURES: readonly DeconstructFailure[] = ['cooldown', 'session', 'network', 'unreadable', 'error'];

const ITEM_ID = /^\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isItemIdList(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0 || value.length > DECONSTRUCT_BATCH_MAX) return false;
  if (!value.every((entry) => typeof entry === 'string' && ITEM_ID.test(entry))) return false;
  return new Set(value).size === value.length;
}

export function isDeconstructStartRequest(value: unknown): value is DeconstructStartRequest {
  return isRecord(value) && isItemIdList(value.itemIds);
}

function isDeconstructRunResult(value: unknown): value is DeconstructRunResult {
  if (!isRecord(value)) return false;
  switch (value.status) {
    case 'burned':
      return (
        isNonNegativeInteger(value.burned) && isNonNegativeInteger(value.gained) && isNonNegativeInteger(value.essence)
      );
    case 'refused':
      return typeof value.code === 'string' && value.code.length > 0;
    case 'failed':
      return DECONSTRUCT_FAILURES.includes(value.reason as DeconstructFailure);
    default:
      return false;
  }
}

export function isDeconstructEvent(value: unknown): value is DeconstructEvent {
  if (!isRecord(value)) return false;
  if (value.type !== 'done') return false;
  if (typeof value.runId !== 'string' || value.runId.length === 0) return false;
  if (!isItemIdList(value.itemIds)) return false;
  return isDeconstructRunResult(value.result);
}

export function isDeconstructInjectRequest(value: unknown): value is DeconstructInjectRequest {
  return isRecord(value) && Array.isArray(value.events) && value.events.every(isDeconstructEvent);
}
