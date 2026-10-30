import type { LicenceReason, LicenceState, PremiumLicenceView } from '@bombfarm/contracts';
import type { LeaseCheck, LeasePayload } from './lease-verify.js';

/**
 * The Premium licence rules as one pure function: `step(machine, event)` returns the next machine
 * and the effects to run, in order. Nothing here reads a clock, a timer, the disk or the network;
 * times arrive on events and every side effect leaves as data. The runner executes the effects.
 */

export type RemovalReason = 'ended' | 'moved' | 'released';

/** The linked game account as the session reads it. */
export interface Pair {
  readonly accountId: string;
  readonly steamId64: string;
}

/** What the machine knows about this PC's identity for the signed-in subject. */
export interface DeviceInfo {
  readonly keyId: string;
  readonly deviceId: string | null;
  readonly hasSalt: boolean;
}

/** The exact envelope of an accepted Lease, as the store seals it. */
export interface LeaseSeal {
  readonly leaseB64: string;
  readonly sig: string;
  readonly keyId: string;
}

export type RequestKind = 'salt' | 'activate' | 'move' | 'renew' | 'cleanup';

/** A request, or the local identity step that precedes one, that is waiting for its answer. */
export type InFlight = RequestKind | 'ensure';

export const RENEW_EVERY_MS = 15 * 60_000;
/** Retry delays after a failure: 1, 2, 5, then 15 minutes for every later one. */
export const RETRY_SCHEDULE_MS: readonly number[] = [60_000, 120_000, 300_000, 900_000];

const REMOVAL_STATES: readonly LicenceState[] = ['moved', 'released', 'ended'];

export interface Machine {
  /** The Premium surface is on for this flavour. Off: every event is ignored. */
  readonly enabled: boolean;
  readonly subject: string | null;
  /** Bumped on every sign-in and sign-out; an answer from an older one is dropped. */
  readonly generation: number;
  readonly device: DeviceInfo | null;
  /** Last status fetch; null before the first. */
  readonly premiumActive: boolean | null;
  readonly pair: Pair | null;
  readonly lease: { readonly payload: LeasePayload; readonly windowEndsMono: number } | null;
  /** `until` of the last accepted Lease; undefined when none was ever accepted. */
  readonly lastUntil: string | null | undefined;
  readonly state: LicenceState;
  readonly reason?: LicenceReason;
  readonly holderName?: string;
  readonly lastMoveAt?: string;
  readonly nextMoveAt?: string;
  readonly inFlight: InFlight | null;
  /** An event that changed what a request would say arrived while one was in flight. */
  readonly followUp: boolean;
  /** Index into the retry schedule of the next failure. */
  readonly retryStep: number;
  /** A device_foreign answer already restarted this sign-in at once; the next one waits its turn. */
  readonly foreignRetried: boolean;
  /** A removal report is owed for this reason; `folderGone` once the premium host answered. */
  readonly cleanup: { readonly owed: RemovalReason | null; readonly folderGone: boolean };
  /** The user pressed Move and no answer has settled it. */
  readonly moveIntent: boolean;
  readonly moveFailed: boolean;
  /** True once the premium code is gone from this PC (the full removal line may show). */
  readonly removalDone: boolean;
}

export function initialMachine(enabled: boolean): Machine {
  return {
    enabled,
    subject: null,
    generation: 0,
    device: null,
    premiumActive: null,
    pair: null,
    lease: null,
    lastUntil: undefined,
    state: 'signed_out',
    inFlight: null,
    followUp: false,
    retryStep: 0,
    foreignRetried: false,
    cleanup: { owed: null, folderGone: false },
    moveIntent: false,
    moveFailed: false,
    removalDone: false,
  };
}

/** What a request came back with, decoded; a Lease is already verified. */
export type Outcome =
  | {
      readonly kind: 'lease';
      readonly payload: LeasePayload;
      /** `min(expiresAt - issuedAt, 60 min)`, counted from receipt. */
      readonly windowMs: number;
      readonly seal: LeaseSeal;
      /** Present on an activation answer. */
      readonly deviceId: string | null;
    }
  | { readonly kind: 'leaseInvalid'; readonly check: LeaseCheck }
  | { readonly kind: 'heldElsewhere'; readonly holderName: string; readonly nextMoveAt: string | null }
  | { readonly kind: 'moveLimit'; readonly lastMoveAt: string; readonly nextMoveAt: string }
  | { readonly kind: 'mismatch' }
  | { readonly kind: 'premiumInactive' }
  | { readonly kind: 'foreign' }
  | { readonly kind: 'deviceSignature' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'notLeft' }
  | { readonly kind: 'cleanup'; readonly result: 'confirmed' | 'lapsed' }
  | { readonly kind: 'salt' }
  | { readonly kind: 'failed'; readonly retryAfterSec?: number };

export interface Begin {
  readonly subject: string | null;
  readonly device: DeviceInfo | null;
  /** The sealed Lease, already re-verified by the runner; it never opens the gate. */
  readonly sealedLease: LeasePayload | null;
  /** The sealed "cleanup owed" marker, if any. */
  readonly cleanupOwed: RemovalReason | null;
  readonly wall: number;
}

export type Event =
  | ({ readonly t: 'started'; readonly enabled: boolean } & Begin)
  | ({ readonly t: 'signedIn' } & Begin)
  | { readonly t: 'signedOut' }
  | { readonly t: 'status'; readonly active: boolean }
  | { readonly t: 'pair'; readonly pair: Pair | null; readonly allows: boolean }
  | { readonly t: 'trigger'; readonly why: 'resume' | 'refresh' | 'timer' }
  | { readonly t: 'movePressed' }
  | { readonly t: 'folderGone' }
  | { readonly t: 'windowEnded'; readonly mono: number }
  | { readonly t: 'deviceReady'; readonly device: DeviceInfo }
  | { readonly t: 'identityFailed'; readonly reason: 'no_secure_storage' | 'no_fingerprint' }
  | {
      readonly t: 'answer';
      readonly of: RequestKind;
      readonly generation: number;
      readonly outcome: Outcome;
      readonly mono: number;
      readonly wall: number;
    };

export type Effect =
  /** Generate and seal this subject's device key if there is none; reply `deviceReady` or `identityFailed`. */
  | { readonly e: 'ensureDevice' }
  | { readonly e: 'forgetDevice' }
  | { readonly e: 'saveDeviceId'; readonly deviceId: string }
  | { readonly e: 'fetchSalt' }
  | { readonly e: 'activate'; readonly move: boolean }
  | { readonly e: 'renew' }
  | { readonly e: 'cleanup' }
  | { readonly e: 'arm'; readonly timer: 'renew'; readonly inMs: number }
  | { readonly e: 'arm'; readonly timer: 'window'; readonly inMs: number }
  | { readonly e: 'disarm'; readonly timer: 'renew' | 'window' }
  | { readonly e: 'sealLease'; readonly seal: LeaseSeal }
  | { readonly e: 'markCleanupOwed'; readonly reason: RemovalReason }
  | { readonly e: 'clearCleanupOwed' }
  | { readonly e: 'requestRemoval'; readonly reason: RemovalReason }
  | { readonly e: 'signOut' }
  | { readonly e: 'publish' }
  | { readonly e: 'log'; readonly event: 'premium.licence_state'; readonly fields: LicenceStateLog }
  | { readonly e: 'log'; readonly event: 'premium.lease_rejected'; readonly fields: { readonly check: LeaseCheck } };

export interface LicenceStateLog {
  readonly state: LicenceState;
  readonly reason?: LicenceReason;
}

export interface StepResult {
  readonly machine: Machine;
  readonly effects: readonly Effect[];
}

/** The only licence facts that cross IPC. */
export function licenceView(m: Machine): PremiumLicenceView {
  return {
    state: m.state,
    ...(m.reason === undefined ? {} : { reason: m.reason }),
    ...(m.holderName === undefined ? {} : { holderName: m.holderName }),
    ...(m.lastMoveAt === undefined ? {} : { lastMoveAt: m.lastMoveAt }),
    ...(m.nextMoveAt === undefined ? {} : { nextMoveAt: m.nextMoveAt }),
    moveInFlight: m.moveIntent,
    moveFailed: m.moveFailed,
    removalDone: m.removalDone,
  };
}

function samePair(a: { accountId: string; steamId64: string } | null, b: Pair | null): boolean {
  if (a === null || b === null) return a === b;
  return a.accountId === b.accountId && a.steamId64 === b.steamId64;
}

/**
 * May premium code run now? An accepted Lease inside its window, state `active`, this PC's device
 * key, the Lease's pair equal to the session's, and the playing-account gate open. A restart never
 * restores a Lease, so this is false until the first answer of the run.
 */
export function leaseGateOpen(m: Machine, mono: number, accountAllows: boolean): boolean {
  const lease = m.lease;
  if (!m.enabled || m.subject === null || lease === null || m.device === null || !accountAllows) return false;
  return (
    mono < lease.windowEndsMono &&
    lease.payload.state === 'active' &&
    lease.payload.deviceKeyId === m.device.keyId &&
    samePair(lease.payload.playing, m.pair)
  );
}

type Draft = { -readonly [K in keyof Machine]: Machine[K] };

interface Work {
  readonly m: Draft;
  readonly fx: Effect[];
}

function isRemoval(state: LicenceState): state is RemovalReason {
  return REMOVAL_STATES.includes(state);
}

function clearDetails(m: Draft): void {
  delete m.reason;
  delete m.holderName;
  delete m.lastMoveAt;
  delete m.nextMoveAt;
}

function setState(m: Draft, state: LicenceState, reason?: LicenceReason): void {
  m.state = state;
  clearDetails(m);
  if (reason !== undefined) m.reason = reason;
}

/** Picks the one request the machine owes now, if any, and marks it in flight. */
function pump(w: Work): void {
  const { m, fx } = w;
  if (!m.enabled || m.subject === null || m.inFlight !== null) return;
  if (m.cleanup.owed !== null) {
    if (!m.cleanup.folderGone) return;
    if (m.device === null) {
      // Nothing to sign the report with: it can never be answered.
      m.cleanup = { owed: null, folderGone: false };
      fx.push({ e: 'clearCleanupOwed' });
      pump(w);
      return;
    }
    m.inFlight = 'cleanup';
    fx.push({ e: 'cleanup' });
    return;
  }
  if (m.device === null) {
    m.inFlight = 'ensure';
    fx.push({ e: 'ensureDevice' });
    return;
  }
  if (!m.device.hasSalt) {
    m.inFlight = 'salt';
    fx.push({ e: 'fetchSalt' });
    return;
  }
  if (m.moveIntent) {
    m.inFlight = 'move';
    fx.push({ e: 'activate', move: true });
    return;
  }
  if (m.device.deviceId !== null) {
    m.inFlight = 'renew';
    fx.push({ e: 'renew' });
    return;
  }
  if (m.premiumActive === true) {
    m.inFlight = 'activate';
    fx.push({ e: 'activate', move: false });
  }
}

/** Ask for a request now, or remember to after the one in flight when the news is fresh. */
function want(w: Work, news: boolean): void {
  if (w.m.inFlight !== null) {
    // The identity steps (`ensure`, `salt`) end by picking the request from the state as it is then,
    // so news that arrives during one is already in it; only a request on the wire can miss it.
    if (news && w.m.inFlight !== 'ensure' && w.m.inFlight !== 'salt') w.m.followUp = true;
    return;
  }
  pump(w);
}

function afterAnswer(w: Work): void {
  if (w.m.followUp && w.m.inFlight === null) {
    w.m.followUp = false;
    pump(w);
  }
}

function enterRemoval(w: Work, reason: RemovalReason): void {
  w.m.cleanup = { owed: reason, folderGone: false };
  w.m.removalDone = false;
  w.fx.push({ e: 'markCleanupOwed', reason }, { e: 'requestRemoval', reason });
}

/** Offline past the last known end: paused states become `ended` and removal starts. */
function endedByDate(w: Work, wall: number, disarm: boolean): boolean {
  const { m } = w;
  if (typeof m.lastUntil !== 'string') return false;
  if (m.state !== 'holds' && m.state !== 'unconfirmed') return false;
  if (!(wall > Date.parse(m.lastUntil))) return false;
  setState(m, 'ended');
  m.lease = null;
  if (disarm) w.fx.push({ e: 'disarm', timer: 'window' }, { e: 'disarm', timer: 'renew' });
  enterRemoval(w, 'ended');
  return true;
}

function begin(w: Work, input: Begin, enabled: boolean): void {
  const { m } = w;
  m.enabled = enabled;
  if (!enabled || input.subject === null) {
    // A start with no one signed in is the same as signed out.
    signedOutInPlace(w);
    return;
  }
  m.subject = input.subject;
  m.generation += 1;
  m.device = input.device;
  m.premiumActive = null;
  m.lease = null;
  m.lastUntil = input.sealedLease === null ? undefined : input.sealedLease.until;
  m.inFlight = null;
  m.followUp = false;
  m.retryStep = 0;
  m.foreignRetried = false;
  m.moveIntent = false;
  m.moveFailed = false;
  m.cleanup = { owed: input.cleanupOwed, folderGone: false };

  // A restart never restores `holds`: only a removal state the sealed records vouch for comes back.
  const sealedState = input.sealedLease?.state;
  const restored: RemovalReason | null =
    input.cleanupOwed ?? (sealedState === 'moved' || sealedState === 'released' || sealedState === 'ended' ? sealedState : null);
  setState(m, restored ?? 'unconfirmed');
  if (restored === 'moved' && input.sealedLease?.holderName !== undefined) m.holderName = input.sealedLease.holderName;
  m.removalDone = restored !== null && input.cleanupOwed === null;

  w.fx.push({ e: 'disarm', timer: 'window' }, { e: 'disarm', timer: 'renew' });
  if (input.cleanupOwed !== null) w.fx.push({ e: 'requestRemoval', reason: input.cleanupOwed });
  else endedByDate(w, input.wall, false);
  pump(w);
}

function signedOutInPlace(w: Work): void {
  const { m } = w;
  const was = m.subject !== null || m.state !== 'signed_out';
  m.subject = null;
  m.generation += 1;
  m.device = null;
  m.premiumActive = null;
  m.pair = null;
  m.lease = null;
  m.lastUntil = undefined;
  m.inFlight = null;
  m.followUp = false;
  m.retryStep = 0;
  m.foreignRetried = false;
  m.cleanup = { owed: null, folderGone: false };
  m.moveIntent = false;
  m.moveFailed = false;
  m.removalDone = false;
  setState(m, 'signed_out');
  if (was) w.fx.push({ e: 'disarm', timer: 'window' }, { e: 'disarm', timer: 'renew' });
}

function armRetry(w: Work, retryAfterSec?: number): void {
  const { m } = w;
  const step = Math.min(m.retryStep, RETRY_SCHEDULE_MS.length - 1);
  const scheduled = RETRY_SCHEDULE_MS[step] ?? 900_000;
  const inMs = retryAfterSec === undefined ? scheduled : Math.max(scheduled, retryAfterSec * 1000);
  m.retryStep = Math.min(m.retryStep + 1, RETRY_SCHEDULE_MS.length - 1);
  w.fx.push({ e: 'arm', timer: 'renew', inMs });
}

function settled(m: Draft): void {
  m.retryStep = 0;
  m.foreignRetried = false;
  m.moveIntent = false;
  m.moveFailed = false;
}

/** A failed Move leaves the state as it was (a press changes nothing until an answer does). */
function failedMove(m: Draft): void {
  m.moveIntent = false;
  m.moveFailed = true;
}

function onLease(w: Work, outcome: Extract<Outcome, { kind: 'lease' }>, mono: number): void {
  const { m, fx } = w;
  const { payload } = outcome;
  const previous = m.state;
  const next: LicenceState =
    payload.state === 'active' || payload.state === 'paused_other_account' ? 'holds' : payload.state;
  if (outcome.deviceId !== null && m.device !== null && m.device.deviceId !== outcome.deviceId) {
    m.device = { ...m.device, deviceId: outcome.deviceId };
    fx.push({ e: 'saveDeviceId', deviceId: outcome.deviceId });
  }
  settled(m);
  m.lease = { payload, windowEndsMono: mono + outcome.windowMs };
  m.lastUntil = payload.until;
  setState(m, next);
  if (next === 'moved' && payload.holderName !== undefined) m.holderName = payload.holderName;
  fx.push({ e: 'sealLease', seal: outcome.seal });
  if (next === 'holds') {
    m.removalDone = false;
    fx.push({ e: 'arm', timer: 'window', inMs: outcome.windowMs });
  } else {
    fx.push({ e: 'disarm', timer: 'window' });
  }
  fx.push({ e: 'arm', timer: 'renew', inMs: RENEW_EVERY_MS });
  if (isRemoval(next) && previous !== next) enterRemoval(w, next);
}

function dropLease(w: Work): void {
  w.m.lease = null;
  w.fx.push({ e: 'disarm', timer: 'window' });
}

function onFailure(w: Work, of: RequestKind, outcome: Outcome, wall: number): void {
  const { m } = w;
  const invalid = outcome.kind === 'leaseInvalid';
  if (invalid) w.fx.push({ e: 'log', event: 'premium.lease_rejected', fields: { check: outcome.check } });
  if (of === 'move') {
    failedMove(m);
    return;
  }
  if (endedByDate(w, wall, true)) return;
  if (m.state === 'unconfirmed') m.reason = invalid ? 'lease_invalid' : 'network';
  armRetry(w, outcome.kind === 'failed' ? outcome.retryAfterSec : undefined);
}

function onAnswer(w: Work, ev: Extract<Event, { t: 'answer' }>): void {
  const { m, fx } = w;
  m.inFlight = null;
  let { outcome } = ev;
  // A report cannot be answered by anything but its own outcomes; the rest is a failed try.
  if (
    ev.of === 'cleanup' &&
    (outcome.kind === 'mismatch' ||
      outcome.kind === 'lease' ||
      outcome.kind === 'leaseInvalid' ||
      outcome.kind === 'heldElsewhere' ||
      outcome.kind === 'moveLimit' ||
      outcome.kind === 'premiumInactive')
  ) {
    outcome = { kind: 'failed' };
  }

  switch (outcome.kind) {
    case 'lease':
      onLease(w, outcome, ev.mono);
      break;
    case 'leaseInvalid':
    case 'failed':
      onFailure(w, ev.of, outcome, ev.wall);
      break;
    case 'heldElsewhere':
      settled(m);
      dropLease(w);
      setState(m, 'elsewhere');
      m.holderName = outcome.holderName;
      if (outcome.nextMoveAt !== null) m.nextMoveAt = outcome.nextMoveAt;
      break;
    case 'moveLimit':
      settled(m);
      dropLease(w);
      setState(m, 'move_limit');
      m.lastMoveAt = outcome.lastMoveAt;
      m.nextMoveAt = outcome.nextMoveAt;
      break;
    case 'mismatch':
      settled(m);
      dropLease(w);
      setState(m, 'mismatch');
      break;
    case 'premiumInactive':
      settled(m);
      dropLease(w);
      setState(m, 'inactive');
      break;
    case 'foreign':
      // This key belongs to someone else: forget it and start again as a new PC. A pressed Move
      // stays pressed.
      m.lease = null;
      fx.push({ e: 'disarm', timer: 'window' }, { e: 'forgetDevice' });
      if (ev.of === 'cleanup') {
        m.cleanup = { owed: null, folderGone: false };
        fx.push({ e: 'clearCleanupOwed' });
      }
      m.device = null;
      if (m.state === 'holds') setState(m, 'unconfirmed', 'network');
      if (m.foreignRetried) {
        // The API keeps refusing fresh keys: wait out the normal backoff instead of looping.
        armRetry(w);
      } else {
        m.foreignRetried = true;
        m.retryStep = 0;
        pump(w);
      }
      break;
    case 'deviceSignature':
      if (ev.of === 'move') {
        failedMove(m);
        break;
      }
      if (m.state === 'holds' || m.state === 'unconfirmed') setState(m, 'unconfirmed', 'device_signature');
      armRetry(w);
      break;
    case 'unauthorized':
      fx.push({ e: 'signOut' });
      return;
    case 'notLeft':
    case 'cleanup':
      m.retryStep = 0;
      m.cleanup = { owed: null, folderGone: false };
      fx.push({ e: 'clearCleanupOwed' });
      pump(w);
      break;
    case 'salt':
      if (m.device !== null) m.device = { ...m.device, hasSalt: true };
      pump(w);
      break;
  }
  afterAnswer(w);
}

function onStatus(w: Work, active: boolean): void {
  const { m } = w;
  const previous = m.premiumActive;
  m.premiumActive = active;
  if (m.cleanup.owed !== null) return;
  const linked = m.device !== null && m.device.deviceId !== null;
  if (!active) {
    if (!linked && !isRemoval(m.state)) setState(m, 'inactive');
    // The status never ends a licence: a holder only renews at once and lets the Lease decide.
    else if (m.state === 'holds') want(w, true);
    return;
  }
  const fresh = !linked && previous !== true;
  if (fresh || m.state === 'inactive' || m.state === 'ended') want(w, true);
}

function onMovePressed(w: Work): void {
  const { m } = w;
  const eligible = m.state === 'elsewhere' || m.state === 'mismatch' || m.state === 'released';
  if (!eligible || m.inFlight !== null || m.moveIntent || m.cleanup.owed !== null) return;
  m.moveIntent = true;
  m.moveFailed = false;
  if (m.state === 'mismatch') {
    // Recovering from a mismatch takes a fresh device key.
    m.device = null;
    w.fx.push({ e: 'forgetDevice' });
  }
  pump(w);
}

function onWindowEnded(w: Work, mono: number): void {
  const { m } = w;
  if (m.lease === null || mono < m.lease.windowEndsMono) return;
  m.lease = null;
  if (m.state === 'holds') setState(m, 'unconfirmed', 'network');
}

function onIdentityFailed(w: Work, reason: 'no_secure_storage' | 'no_fingerprint'): void {
  const { m } = w;
  m.inFlight = null;
  m.followUp = false;
  m.moveIntent = false;
  if (!isRemoval(m.state) && m.state !== 'inactive') setState(m, 'unconfirmed', reason);
  if (reason === 'no_fingerprint') armRetry(w);
}

function dispatch(w: Work, ev: Event): void {
  const { m } = w;
  switch (ev.t) {
    case 'started':
      begin(w, ev, ev.enabled);
      return;
    case 'signedIn':
      begin(w, ev, m.enabled);
      return;
    case 'signedOut':
      signedOutInPlace(w);
      return;
    case 'status':
      if (m.subject !== null) onStatus(w, ev.active);
      return;
    case 'pair':
      m.pair = ev.pair;
      if (m.subject !== null && ev.allows && m.device !== null && m.device.deviceId !== null) want(w, true);
      return;
    case 'trigger':
      if (m.subject !== null) want(w, false);
      return;
    case 'movePressed':
      if (m.subject !== null) onMovePressed(w);
      return;
    case 'folderGone':
      if (m.cleanup.owed === null) return;
      m.cleanup = { owed: m.cleanup.owed, folderGone: true };
      m.removalDone = true;
      pump(w);
      return;
    case 'windowEnded':
      onWindowEnded(w, ev.mono);
      return;
    case 'deviceReady':
      if (m.subject === null || m.inFlight !== 'ensure') return;
      m.device = ev.device;
      m.inFlight = null;
      pump(w);
      return;
    case 'identityFailed':
      if (m.subject !== null) onIdentityFailed(w, ev.reason);
      return;
    case 'answer':
      if (m.subject === null || ev.generation !== m.generation || m.inFlight !== ev.of) return;
      onAnswer(w, ev);
      return;
  }
}

/**
 * Applies one event. A disabled machine ignores everything. The view changed -> `publish`; the
 * state or reason changed -> a `premium.licence_state` log record, both last.
 */
export function step(machine: Machine, event: Event): StepResult {
  if (!machine.enabled && !(event.t === 'started' && event.enabled)) return { machine, effects: [] };
  const w: Work = { m: { ...machine }, fx: [] };
  dispatch(w, event);
  const next = w.m as Machine;
  if (next.state !== machine.state || next.reason !== machine.reason) {
    w.fx.push({
      e: 'log',
      event: 'premium.licence_state',
      fields: { state: next.state, ...(next.reason === undefined ? {} : { reason: next.reason }) },
    });
  }
  if (JSON.stringify(licenceView(next)) !== JSON.stringify(licenceView(machine))) w.fx.push({ e: 'publish' });
  return { machine: next, effects: w.fx };
}
