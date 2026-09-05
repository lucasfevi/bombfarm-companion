export const ABSENT_DEBOUNCE_MS = 10_000;
export const LAUNCH_WAIT_MS = 90_000;
export const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000] as const;
export const POLL_INTERVAL_MS = 5_000;

export interface KeepAliveState {
  seenThisProcess: boolean;
  enabled: boolean;
  absentSinceMs: number | null;
  inFlightSinceMs: number | null;
  backoffUntilMs: number;
  backoffStep: number;
}

export interface KeepAliveInput {
  nowMs: number;
  enabled: boolean;
  processPresent: boolean;
}

export type KeepAliveAction = 'none' | 'ask-steam';

export interface KeepAliveTick {
  state: KeepAliveState;
  action: KeepAliveAction;
}

const LAST_BACKOFF_STEP = BACKOFF_MS.length - 1;

export function createInitialKeepAliveState(): KeepAliveState {
  return {
    seenThisProcess: false,
    enabled: false,
    absentSinceMs: null,
    inFlightSinceMs: null,
    backoffUntilMs: 0,
    backoffStep: 0,
  };
}

function armBackoff(state: KeepAliveState, nowMs: number): KeepAliveState {
  const step = Math.min(Math.max(state.backoffStep, 0), LAST_BACKOFF_STEP);
  return {
    ...state,
    inFlightSinceMs: null,
    backoffUntilMs: nowMs + (BACKOFF_MS[step] ?? BACKOFF_MS[0]),
    backoffStep: Math.min(step + 1, LAST_BACKOFF_STEP),
  };
}

export function tickKeepAlive(state: KeepAliveState, input: KeepAliveInput): KeepAliveTick {
  const next: KeepAliveState = { ...state, enabled: input.enabled };

  if (input.processPresent) {
    next.seenThisProcess = true;
    next.absentSinceMs = null;
    if (next.inFlightSinceMs !== null) {
      next.inFlightSinceMs = null;
      next.backoffStep = 0;
      next.backoffUntilMs = 0;
    }
    return { state: next, action: 'none' };
  }

  const absentSinceMs = next.absentSinceMs ?? input.nowMs;
  next.absentSinceMs = absentSinceMs;

  if (next.inFlightSinceMs !== null) {
    if (input.nowMs - next.inFlightSinceMs < LAUNCH_WAIT_MS) {
      return { state: next, action: 'none' };
    }
    return { state: armBackoff(next, input.nowMs), action: 'none' };
  }

  const askable =
    next.enabled &&
    next.seenThisProcess &&
    input.nowMs - absentSinceMs >= ABSENT_DEBOUNCE_MS &&
    input.nowMs >= next.backoffUntilMs;

  if (!askable) {
    return { state: next, action: 'none' };
  }

  next.inFlightSinceMs = input.nowMs;
  return { state: next, action: 'ask-steam' };
}

export function applyEnabledChange(state: KeepAliveState, enabled: boolean, nowMs: number): KeepAliveState {
  const turnedOnOverAnAbsentGame = enabled && !state.enabled && state.seenThisProcess && state.absentSinceMs !== null;
  return {
    ...state,
    enabled,
    absentSinceMs: turnedOnOverAnAbsentGame ? nowMs : state.absentSinceMs,
  };
}

export function recordAskFailure(state: KeepAliveState, nowMs: number): KeepAliveState {
  return armBackoff(state, nowMs);
}
