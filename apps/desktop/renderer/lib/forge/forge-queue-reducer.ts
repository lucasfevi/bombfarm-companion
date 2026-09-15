/**
 * The forge queue as a pure reducer: the pieces waiting in order, whether the queue is running,
 * the one it has asked main to forge, and why it halted. Main forges one piece at a time and
 * knows nothing of a queue; the store around this reducer starts the head piece whenever the
 * queue is running with nothing in flight, and folds main's answers and its `done` back in here.
 */
import type { ForgeRunResult, ForgeStartReason, ForgeStopReason } from '@bombfarm/contracts';

export type ForgeQueuePiece = {
  readonly itemId: string;
  readonly target: number;
};

export type ForgeQueueHalt =
  | { readonly kind: 'stop'; readonly itemId: string; readonly stop: ForgeStopReason }
  | { readonly kind: 'refused'; readonly itemId: string; readonly reason: ForgeStartReason };

export type ForgeQueueState = {
  readonly pieces: readonly ForgeQueuePiece[];
  /** `halted` is a queue that was running and stopped on its head piece; Start resumes it. */
  readonly status: 'idle' | 'running' | 'halted';
  /** The piece the queue has asked main to forge; `runId` is null until main answers. */
  readonly active: { readonly itemId: string; readonly runId: string | null } | null;
  readonly halt: ForgeQueueHalt | null;
  /** Pieces this queue has forged to their target since it was last empty — the `2` of `2/5`. */
  readonly forged: number;
};

export type ForgeQueueAction =
  | { kind: 'add'; itemId: string; target: number }
  | { kind: 'remove'; itemId: string }
  /** Every waiting piece leaves; the one in flight, if any, finishes on its own. */
  | { kind: 'clear' }
  | { kind: 'start' }
  | { kind: 'requested'; itemId: string }
  | { kind: 'started'; itemId: string; runId: string }
  | { kind: 'refused'; itemId: string; reason: ForgeStartReason }
  | { kind: 'done'; runId: string; result: ForgeRunResult }
  | { kind: 'cancel' }
  /** The bag as the account reads now: a waiting piece that is gone or already at its target
   *  has nothing left to forge and leaves the queue. */
  | { kind: 'sync'; upgrades: ReadonlyMap<string, number> }
  | { kind: 'restore'; pieces: readonly ForgeQueuePiece[] };

export const EMPTY_FORGE_QUEUE: ForgeQueueState = { pieces: [], status: 'idle', active: null, halt: null, forged: 0 };

/** A refusal about the piece rather than the environment — it cannot be forged any more, so the
 *  queue drops it and moves on instead of halting. */
export function refusalDropsPiece(reason: ForgeStartReason): boolean {
  return reason === 'unknown_item' || reason === 'bad_target';
}

/** The piece the queue will ask for next, or is forging now. */
export function forgeQueueHead(state: ForgeQueueState): ForgeQueuePiece | null {
  return state.pieces[0] ?? null;
}

function without(pieces: readonly ForgeQueuePiece[], itemId: string): ForgeQueuePiece[] {
  return pieces.filter((piece) => piece.itemId !== itemId);
}

function afterHeadLeaves(state: ForgeQueueState, pieces: readonly ForgeQueuePiece[], reached: boolean): ForgeQueueState {
  const status = state.status === 'running' && pieces.length > 0 ? 'running' : 'idle';
  const forged = pieces.length === 0 ? 0 : state.forged + (reached ? 1 : 0);
  return { pieces, status, active: null, halt: null, forged };
}

export function forgeQueueReducer(state: ForgeQueueState, action: ForgeQueueAction): ForgeQueueState {
  switch (action.kind) {
    case 'add': {
      const existing = state.pieces.find((piece) => piece.itemId === action.itemId);
      if (existing === undefined) {
        return { ...state, pieces: [...state.pieces, { itemId: action.itemId, target: action.target }] };
      }
      if (existing.target === action.target || state.active?.itemId === action.itemId) return state;
      return {
        ...state,
        pieces: state.pieces.map((piece) => (piece === existing ? { ...piece, target: action.target } : piece)),
      };
    }
    case 'remove': {
      if (state.active?.itemId === action.itemId) return state;
      const pieces = without(state.pieces, action.itemId);
      if (pieces.length === state.pieces.length) return state;
      const forged = pieces.length === 0 ? 0 : state.forged;
      if (state.halt?.itemId === action.itemId) return { pieces, status: 'idle', active: null, halt: null, forged };
      return { ...state, pieces, forged, status: pieces.length === 0 ? 'idle' : state.status };
    }
    case 'clear': {
      const pieces = state.pieces.filter((piece) => state.active?.itemId === piece.itemId);
      if (pieces.length === state.pieces.length) return state;
      if (pieces.length === 0) return { pieces, status: 'idle', active: null, halt: null, forged: 0 };
      return { ...state, pieces, halt: null };
    }
    case 'start':
      if (state.status === 'running' || state.pieces.length === 0) return state;
      return { ...state, status: 'running', halt: null };
    case 'requested':
      if (state.status !== 'running' || state.active !== null || forgeQueueHead(state)?.itemId !== action.itemId) return state;
      return { ...state, active: { itemId: action.itemId, runId: null } };
    case 'started':
      if (state.active?.itemId !== action.itemId) return state;
      return { ...state, active: { itemId: action.itemId, runId: action.runId } };
    case 'refused': {
      if (state.active?.itemId !== action.itemId) return state;
      if (refusalDropsPiece(action.reason)) return afterHeadLeaves(state, without(state.pieces, action.itemId), false);
      if (state.status !== 'running') return { ...state, active: null };
      return { ...state, status: 'halted', active: null, halt: { kind: 'refused', itemId: action.itemId, reason: action.reason } };
    }
    case 'done': {
      if (state.active === null || state.active.runId !== action.runId) return state;
      const { itemId } = state.active;
      if (action.result.stop === 'target') return afterHeadLeaves(state, without(state.pieces, itemId), true);
      if (state.status !== 'running' || action.result.stop === 'cancelled') {
        return { ...state, status: 'idle', active: null, halt: null };
      }
      return { ...state, status: 'halted', active: null, halt: { kind: 'stop', itemId, stop: action.result.stop } };
    }
    case 'cancel':
      if (state.status === 'idle' && state.halt === null) return state;
      return { ...state, status: 'idle', halt: null };
    case 'sync': {
      const pieces = state.pieces.filter((piece) => {
        if (state.active?.itemId === piece.itemId) return true;
        const upgrade = action.upgrades.get(piece.itemId);
        return upgrade !== undefined && upgrade < piece.target;
      });
      if (pieces.length === state.pieces.length) return state;
      const haltGone = state.halt !== null && !pieces.some((piece) => piece.itemId === state.halt?.itemId);
      const forged = pieces.length === 0 ? 0 : state.forged;
      if (haltGone) return { pieces, status: 'idle', active: null, halt: null, forged };
      return { ...state, pieces, forged, status: pieces.length === 0 && state.active === null ? 'idle' : state.status };
    }
    case 'restore':
      if (state !== EMPTY_FORGE_QUEUE || action.pieces.length === 0) return state;
      return { ...state, pieces: [...action.pieces] };
  }
}
