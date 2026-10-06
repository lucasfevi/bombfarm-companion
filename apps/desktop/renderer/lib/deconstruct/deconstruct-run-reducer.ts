/**
 * A burn as the page sees it — a pure reducer over what the player asked for and the one event
 * main pushes when the server has answered. `idle → starting → running → result → idle`. A batch
 * is a single call, so there is no progress to fold, only a settled outcome; a `done` for a run
 * this page did not start (one injected by the smoke, or begun before the page mounted) is
 * adopted as the result rather than dropped.
 */
import type { DeconstructDoneEvent, DeconstructFailure, DeconstructStartReason } from '@bombfarm/contracts';

export type DeconstructOutcome =
  | { readonly kind: 'burned'; readonly burned: number; readonly gained: number; readonly essence: number }
  | { readonly kind: 'refused'; readonly code: string }
  | { readonly kind: 'failed'; readonly reason: DeconstructFailure }
  | { readonly kind: 'start-refused'; readonly reason: DeconstructStartReason };

export type DeconstructRunState =
  | { readonly status: 'idle' }
  | { readonly status: 'starting' }
  | { readonly status: 'running'; readonly runId: string; readonly itemIds: readonly string[] }
  | { readonly status: 'result'; readonly runId: string | null; readonly outcome: DeconstructOutcome };

export type DeconstructRunAction =
  | { kind: 'starting' }
  | { kind: 'began'; runId: string; itemIds: readonly string[] }
  | { kind: 'start-refused'; reason: DeconstructStartReason }
  | { kind: 'done'; event: DeconstructDoneEvent }
  | { kind: 'dismiss' };

export const IDLE_DECONSTRUCT_RUN: DeconstructRunState = { status: 'idle' };

function outcomeOf(result: DeconstructDoneEvent['result']): DeconstructOutcome {
  switch (result.status) {
    case 'burned':
      return { kind: 'burned', burned: result.burned, gained: result.gained, essence: result.essence };
    case 'refused':
      return { kind: 'refused', code: result.code };
    case 'failed':
      return { kind: 'failed', reason: result.reason };
  }
}

export function deconstructRunReducer(state: DeconstructRunState, action: DeconstructRunAction): DeconstructRunState {
  switch (action.kind) {
    case 'starting':
      return state.status === 'starting' || state.status === 'running' ? state : { status: 'starting' };
    case 'began':
      if (state.status === 'result' && state.runId === action.runId) return state;
      return { status: 'running', runId: action.runId, itemIds: action.itemIds };
    case 'start-refused':
      return state.status === 'running' ? state : { status: 'result', runId: null, outcome: { kind: 'start-refused', reason: action.reason } };
    case 'done':
      return { status: 'result', runId: action.event.runId, outcome: outcomeOf(action.event.result) };
    case 'dismiss':
      return state.status === 'result' ? IDLE_DECONSTRUCT_RUN : state;
  }
}

/** A run that has just settled — the page re-reads its pinned account the moment this holds. */
export function justSettled(previous: DeconstructRunState['status'], next: DeconstructRunState['status']): boolean {
  return previous !== 'result' && next === 'result';
}

/** A burn in flight owns the screen: nothing can be ticked into or started over it. */
export function isBurning(state: DeconstructRunState): boolean {
  return state.status === 'starting' || state.status === 'running';
}
