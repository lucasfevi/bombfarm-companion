import type { PremiumHostView } from '@bombfarm/contracts';
import type { RemovalReason } from '../licence/licence-machine.js';

/**
 * The Premium host's rules as one pure function: `step(state, event)` returns the next state and
 * the effects to run, in order. Nothing here reads a clock, a timer, the disk or the network;
 * times arrive on events and every side effect leaves as data. The runner executes the effects.
 *
 * The machine never holds bundle bytes. It decides which sequence is active, staged or being
 * fetched; the runner keeps the verified bytes and acts on `fetch`, `persist` and `activate`.
 */

export type HostPhase =
  /** The flavour has no Premium, or nobody is signed in. */
  | 'off'
  /** Nothing verified that fits is active; a download may be running. */
  | 'waiting'
  /** A verified fitting bundle is active and the gate is closed: not started yet, or Paused. */
  | 'ready'
  /** The worker is up and the UI may mount. */
  | 'running'
  /** The worker crashed twice or the UI failed to mount; until the next app start. */
  | 'stopped'
  /** Removal is under way. */
  | 'removing'
  /** Removal finished and `folderGone` was sent for this end event. */
  | 'gone';

export interface ActiveBundle {
  readonly sequence: number;
  readonly version: string;
  /** The local development bundle: unsigned, never cached, ignores the Lease floor. */
  readonly dev: boolean;
}

/** A verified bundle already on disk that waits for the next start. */
export interface StagedBundle {
  readonly sequence: number;
  readonly version: string;
}

export interface HostState {
  /** The flavour offers Premium. Off: every event is ignored. */
  readonly enabled: boolean;
  readonly phase: HostPhase;
  readonly subject: string | null;
  /** The last value the licence gate reported. */
  readonly gate: boolean;
  /** The last Lease floor reported; 0 before any. */
  readonly floor: number;
  /** The newest sequence the last renewal named. */
  readonly latest: number | null;
  readonly active: ActiveBundle | null;
  readonly staged: StagedBundle | null;
  /** The sequence being downloaded; one at a time. */
  readonly fetching: number | null;
  /** A worker was started this session, or a restart is pending, and the host has not stopped it. */
  readonly workerRan: boolean;
  /** Monotonic times of exits the host did not ask for. */
  readonly crashes: readonly number[];
  readonly pendingRemoval: RemovalReason | null;
}

/** One bundle folder found in the cache, as the runner re-verified it for this start. */
export interface CachedEntry {
  readonly sequence: number;
  readonly version: string;
  /** Passed the signature, file and freshness checks and fits this app. */
  readonly valid: boolean;
}

export interface CacheScan {
  /** The subject the highest-accepted record belongs to; null when there is none. */
  readonly owner: string | null;
  readonly bundles: readonly CachedEntry[];
}

/** What the machine needs to know about a download's end. */
export type FetchSummary =
  | { readonly ok: true; readonly sequence: number; readonly version: string }
  | { readonly ok: false; readonly reason: string; readonly sequence: number | null };

export type HostEvent =
  | {
      readonly t: 'started';
      readonly subject: string | null;
      readonly dev: { readonly version: string } | null;
      readonly cache: CacheScan;
    }
  | { readonly t: 'signedOut' }
  | { readonly t: 'gate'; readonly allows: boolean }
  | { readonly t: 'latest'; readonly sequence: number | null }
  | { readonly t: 'floor'; readonly minSequence: number }
  | { readonly t: 'fetched'; readonly outcome: FetchSummary }
  | { readonly t: 'workerExit'; readonly requested: boolean; readonly mono: number }
  | { readonly t: 'mountFailed' }
  | { readonly t: 'removalRequested'; readonly reason: RemovalReason }
  | { readonly t: 'removalStep'; readonly done: boolean };

export type HostEffect =
  /** Download and verify in memory. */
  | { readonly e: 'fetch'; readonly sequence: number }
  /** Write the verified bytes of this sequence and record it as the highest accepted. */
  | { readonly e: 'persist'; readonly sequence: number }
  /** Make this sequence the one served from memory (the development bundle is sequence 0). */
  | { readonly e: 'activate'; readonly sequence: number }
  | { readonly e: 'startWorker'; readonly delayMs?: number }
  /** Kill the worker, if any, and drop its pending calls; a no-op when there is none. */
  | { readonly e: 'stopWorker' }
  /** Tell the worker it is paused; cancel a pending restart when no worker is alive. */
  | { readonly e: 'pauseWorker' }
  /** Tell the worker it resumed; start one instead when none is alive. */
  | { readonly e: 'resumeWorker' }
  | { readonly e: 'reloadWindow' }
  /** Delete every cached folder except this one; no report. */
  | { readonly e: 'pruneCache'; readonly keep: number }
  /** Delete every cached folder and clear the in-memory bundle; no report. */
  | { readonly e: 'dropCache' }
  /** Tombstone, delete with retries, clear the in-memory bundle and the highest-accepted record. */
  | { readonly e: 'remove' }
  | { readonly e: 'folderGone' }
  | { readonly e: 'publish' };

export interface HostStep {
  readonly state: HostState;
  readonly effects: readonly HostEffect[];
}

export const CRASH_RESTART_DELAY_MS = 5_000;
export const CRASH_WINDOW_MS = 10 * 60_000;

export function initialHost(enabled: boolean): HostState {
  return {
    enabled,
    phase: 'off',
    subject: null,
    gate: false,
    floor: 0,
    latest: null,
    active: null,
    staged: null,
    fetching: null,
    workerRan: false,
    crashes: [],
    pendingRemoval: null,
  };
}

/** What the Premium tab is told about the host. The runner adds the URLs of the active bundle. */
export function hostPhase(state: HostState): PremiumHostView['phase'] {
  switch (state.phase) {
    case 'off':
    case 'removing':
    case 'gone':
      return 'none';
    case 'stopped':
      return 'stopped';
    case 'waiting':
      return state.gate ? 'updating' : 'none';
    case 'ready':
      return 'paused';
    case 'running':
      return 'running';
  }
}

function viewKey(state: HostState): string {
  return `${hostPhase(state)}|${String(state.active?.sequence)}|${String(state.active?.dev)}`;
}

/** Where the Premium host may act: signed in, not stopped, not being removed. */
function live(state: HostState): boolean {
  return state.subject !== null && (state.phase === 'waiting' || state.phase === 'ready' || state.phase === 'running');
}

function heldSequence(state: HostState): number {
  return Math.max(state.active?.sequence ?? -1, state.staged?.sequence ?? -1);
}

/** Issues a download when the Lease allows one, nothing newer is held and none is running. */
function maybeFetch(state: HostState, effects: HostEffect[]): HostState {
  const { latest } = state;
  if (
    !live(state) ||
    !state.gate ||
    state.fetching !== null ||
    latest === null ||
    latest < state.floor ||
    state.active?.dev === true ||
    heldSequence(state) >= latest
  ) {
    return state;
  }
  effects.push({ e: 'fetch', sequence: latest });
  return { ...state, fetching: latest };
}

/** The gate is open and a bundle is active: bring the worker up (or back) and show the UI. */
function openGate(state: HostState, effects: HostEffect[]): HostState {
  if (state.phase !== 'ready' || state.active === null || !state.gate) return state;
  effects.push(state.workerRan ? { e: 'resumeWorker' } : { e: 'startWorker' });
  return { ...state, phase: 'running', workerRan: true };
}

function onStarted(state: HostState, event: Extract<HostEvent, { t: 'started' }>, effects: HostEffect[]): HostState {
  const base: HostState = {
    ...state,
    subject: event.subject,
    active: null,
    staged: null,
    fetching: null,
    workerRan: false,
    crashes: [],
    pendingRemoval: null,
  };
  if (state.workerRan) effects.push({ e: 'stopWorker' });
  if (event.subject === null) return { ...base, phase: 'off' };

  const { cache } = event;
  let next: HostState;
  if (event.dev !== null) {
    effects.push({ e: 'activate', sequence: 0 });
    next = { ...base, phase: 'ready', active: { sequence: 0, version: event.dev.version, dev: true } };
  } else if (cache.owner !== null && cache.owner !== event.subject) {
    effects.push({ e: 'dropCache' });
    next = { ...base, phase: 'waiting' };
  } else {
    const best = cache.bundles
      .filter((b) => b.valid && b.sequence >= state.floor)
      .reduce<CachedEntry | null>((top, b) => (top === null || b.sequence > top.sequence ? b : top), null);
    if (best === null) {
      if (cache.bundles.length > 0) effects.push({ e: 'dropCache' });
      next = { ...base, phase: 'waiting' };
    } else {
      effects.push({ e: 'activate', sequence: best.sequence });
      if (cache.bundles.length > 1) effects.push({ e: 'pruneCache', keep: best.sequence });
      next = { ...base, phase: 'ready', active: { sequence: best.sequence, version: best.version, dev: false } };
    }
  }
  return maybeFetch(openGate(next, effects), effects);
}

function onSignedOut(state: HostState, effects: HostEffect[]): HostState {
  effects.push({ e: 'stopWorker' });
  return {
    ...state,
    phase: 'off',
    subject: null,
    gate: false,
    floor: 0,
    latest: null,
    active: null,
    staged: null,
    fetching: null,
    workerRan: false,
    crashes: [],
  };
}

function onGate(state: HostState, allows: boolean, effects: HostEffect[]): HostState {
  if (state.gate === allows) return state;
  const next = { ...state, gate: allows };
  if (!allows) {
    if (next.phase !== 'running') return next;
    effects.push({ e: 'pauseWorker' });
    return { ...next, phase: 'ready' };
  }
  return maybeFetch(openGate(next, effects), effects);
}

function onFloor(state: HostState, minSequence: number, effects: HostEffect[]): HostState {
  const next = { ...state, floor: minSequence };
  const { active } = next;
  const swap = live(next) && active !== null && !active.dev && minSequence > active.sequence;
  if (!swap) return maybeFetch(next, effects);

  effects.push({ e: 'stopWorker' });
  const { staged } = next;
  if (staged !== null && staged.sequence >= minSequence) {
    effects.push({ e: 'activate', sequence: staged.sequence }, { e: 'pruneCache', keep: staged.sequence }, { e: 'reloadWindow' });
    const swapped: HostState = {
      ...next,
      phase: 'ready',
      active: { sequence: staged.sequence, version: staged.version, dev: false },
      staged: null,
      workerRan: false,
    };
    return maybeFetch(openGate(swapped, effects), effects);
  }
  effects.push({ e: 'dropCache' }, { e: 'reloadWindow' });
  return maybeFetch({ ...next, phase: 'waiting', active: null, staged: null, workerRan: false }, effects);
}

function onFetched(state: HostState, outcome: FetchSummary, effects: HostEffect[]): HostState {
  // An answer nobody is waiting for: signed out, removal, or a new start since the request.
  if (state.fetching === null) return state;
  const next = { ...state, fetching: null };
  // A refusal changes nothing; the next try waits for the next renewal or the gate opening.
  if (!outcome.ok) return next;
  if (outcome.sequence <= heldSequence(next) || outcome.sequence < next.floor) return next;

  effects.push({ e: 'persist', sequence: outcome.sequence });
  if (next.phase === 'stopped') return next;
  if (next.active === null) {
    effects.push({ e: 'activate', sequence: outcome.sequence });
    const installed: HostState = {
      ...next,
      phase: 'ready',
      active: { sequence: outcome.sequence, version: outcome.version, dev: false },
    };
    return maybeFetch(openGate(installed, effects), effects);
  }
  return maybeFetch({ ...next, staged: { sequence: outcome.sequence, version: outcome.version } }, effects);
}

function onWorkerExit(state: HostState, mono: number, effects: HostEffect[]): HostState {
  if (state.phase !== 'running' && state.phase !== 'ready') return state;
  const recent = state.crashes.filter((at) => mono - at <= CRASH_WINDOW_MS);
  const next = { ...state, workerRan: false, crashes: [...recent, mono] };
  // A paused worker that dies is started afresh when the gate opens; nothing runs meanwhile.
  if (state.phase === 'ready') return next;
  if (recent.length === 0) {
    effects.push({ e: 'startWorker', delayMs: CRASH_RESTART_DELAY_MS });
    return { ...next, workerRan: true };
  }
  effects.push({ e: 'stopWorker' });
  return { ...next, phase: 'stopped' };
}

function onMountFailed(state: HostState, effects: HostEffect[]): HostState {
  if (state.phase !== 'running' && state.phase !== 'ready') return state;
  effects.push({ e: 'stopWorker' });
  return { ...state, phase: 'stopped', workerRan: false };
}

function onRemovalRequested(state: HostState, reason: RemovalReason, effects: HostEffect[]): HostState {
  // A second request while the first is still deleting is the same end event.
  if (state.phase === 'removing') return state;
  effects.push({ e: 'stopWorker' }, { e: 'reloadWindow' }, { e: 'remove' });
  return {
    ...state,
    phase: 'removing',
    active: null,
    staged: null,
    fetching: null,
    workerRan: false,
    crashes: [],
    pendingRemoval: reason,
  };
}

function apply(state: HostState, event: HostEvent, effects: HostEffect[]): HostState {
  if (!state.enabled) return state;
  if (state.phase === 'removing') {
    if (event.t !== 'removalStep' || !event.done) return state;
    effects.push({ e: 'folderGone' });
    return { ...state, phase: 'gone', pendingRemoval: null };
  }
  switch (event.t) {
    case 'removalRequested':
      return onRemovalRequested(state, event.reason, effects);
    case 'removalStep':
      return state;
    case 'started':
      return onStarted(state, event, effects);
    case 'signedOut':
      return state.phase === 'gone' ? { ...state, phase: 'off', subject: null } : onSignedOut(state, effects);
    case 'gate':
      return onGate(state, event.allows, effects);
    case 'latest':
      return maybeFetch({ ...state, latest: event.sequence }, effects);
    case 'floor':
      return onFloor(state, event.minSequence, effects);
    case 'fetched':
      return onFetched(state, event.outcome, effects);
    case 'workerExit':
      return event.requested ? state : onWorkerExit(state, event.mono, effects);
    case 'mountFailed':
      return onMountFailed(state, effects);
  }
}

/** Applies one event. The effects run in order; `publish` comes last and only when the view changed. */
export function step(state: HostState, event: HostEvent): HostStep {
  const effects: HostEffect[] = [];
  const next = apply(state, event, effects);
  if (viewKey(next) !== viewKey(state)) effects.push({ e: 'publish' });
  return { state: next, effects };
}
