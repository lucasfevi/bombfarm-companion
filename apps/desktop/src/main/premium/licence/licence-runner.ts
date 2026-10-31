import { PLUGIN_API_VERSION, type PremiumLicenceView } from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';
import type { DeviceSignedCall, LicenceAnswer, LicenceOutcome, PremiumApi } from '../premium-api.js';
import type { LicenceHostPort } from '../premium-service.js';
import { PREMIUM_API_PATHS, SIGNED_METHOD } from '../premium-transport.js';
import { deviceHeader } from './device-signature.js';
import { fingerprint } from './fingerprint.js';
import { shippedLeaseKeys, verifyLease, type LeaseKeyTable, type LeasePayload } from './lease-verify.js';
import { appLeaseGate, type LeaseGate } from './lease-gate.js';
import {
  initialMachine,
  leaseGateOpen,
  licenceView,
  step,
  type Begin,
  type DeviceInfo,
  type Effect,
  type Event,
  type Machine,
  type Outcome,
  type RemovalReason,
  type RequestKind,
} from './licence-machine.js';
import { generateDeviceRecord, type DeviceRecord, type LicenceStore } from './licence-store.js';
import type { MachineIdentity } from './machine-id.js';
import type { PremiumRemovalPort } from './removal-port.js';

/** The playing-account gate as the runner sees it: handed in, so the runner never names the gate itself. */
export interface AccountGate {
  allows(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface LicenceServiceDeps {
  host: LicenceHostPort;
  api: PremiumApi;
  store: LicenceStore;
  /** Whether the OS can seal secrets (the sign-in token's box). */
  secureStorage(): boolean;
  identity: MachineIdentity;
  removal: PremiumRemovalPort;
  account: AccountGate;
  now(): number;
  /** A monotonic clock in ms: a Lease's window is counted on it, never on the wall clock. */
  mono(): number;
  scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
  log: LogPort;
  appVersion: string;
  flavor: string;
  /** The Premium surface is on for this flavour. Off: nothing is read, generated or sent. */
  enabled: boolean;
  onChanged(view: PremiumLicenceView): void;
  /** Where the gate's value is written; the app's own gate by default. */
  gate?: LeaseGate;
  keys?: LeaseKeyTable;
}

export interface LicenceService {
  start(): void;
  stop(): void;
  view(): PremiumLicenceView;
  /** The player pressed "Use Premium on this PC". */
  pressMove(): void;
  trigger(why: 'resume' | 'refresh'): void;
  /** The premium host reports that its folder is gone. */
  noteFolderGone(): void;
}

type TimerName = 'renew' | 'window';
type SignedPath = 'licenceActivate' | 'lease' | 'licenceCleanup';

const REMOVAL_REASONS: readonly string[] = ['ended', 'moved', 'released'];

function infoOf(record: DeviceRecord): DeviceInfo {
  return { keyId: record.keyId, deviceId: record.deviceId, hasSalt: record.fingerprintSalt !== null };
}

/** The machine's own words for an answer: a Lease is judged here, a salt is kept here. */
function isRemovalReason(value: string): value is RemovalReason {
  return REMOVAL_REASONS.includes(value);
}

export function createLicenceService(deps: LicenceServiceDeps): LicenceService {
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;
  const gate = deps.gate ?? appLeaseGate;
  const keys = deps.keys ?? shippedLeaseKeys();

  let machine: Machine = initialMachine(deps.enabled);
  let record: DeviceRecord | null = null;
  let offsetMs = 0;
  let running = false;
  /** The last status fetch's answer; the account names the user after it, so it is replayed on sign-in. */
  let lastStatus: boolean | null = null;
  const timers: Record<TimerName, ReturnType<typeof setTimeout> | null> = { renew: null, window: null };
  const unsubscribes: Array<() => void> = [];
  const queue: Event[] = [];
  let draining = false;

  function recomputeGate(): void {
    if (!deps.enabled) return;
    gate.set(leaseGateOpen(machine, deps.mono(), deps.account.allows()), machine.state);
  }

  function clearTimer(name: TimerName): void {
    const held = timers[name];
    if (held !== null) clearTimeoutFn(held);
    timers[name] = null;
  }

  function arm(name: TimerName, inMs: number): void {
    clearTimer(name);
    timers[name] = setTimeoutFn(() => {
      timers[name] = null;
      onTimer(name);
    }, inMs);
  }

  function onTimer(name: TimerName): void {
    if (name === 'renew') {
      dispatch({ t: 'trigger', why: 'timer' });
      return;
    }
    const lease = machine.lease;
    const mono = deps.mono();
    // A timer that fires a hair early must not leave the gate open past the window.
    if (lease !== null && mono < lease.windowEndsMono) {
      arm('window', lease.windowEndsMono - mono);
      return;
    }
    dispatch({ t: 'windowEnded', mono });
  }

  function dispatch(event: Event): void {
    queue.push(event);
    if (draining) return;
    draining = true;
    try {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) apply(next);
    } finally {
      draining = false;
    }
  }

  function apply(event: Event): void {
    const before = machine;
    const result = step(machine, event);
    machine = result.machine;
    // The gate follows the machine before any effect, so a closing gate is known before a request is made.
    recomputeGate();
    const subject = machine.subject ?? before.subject;
    for (const effect of result.effects) execute(effect, subject);
  }

  function beginFor(subject: string | null): Begin {
    if (subject === null) {
      record = null;
      return { subject: null, device: null, sealedLease: null, cleanupOwed: null, wall: deps.now() };
    }
    record = deps.store.readDevice(subject);
    let sealedLease: LeasePayload | null = null;
    if (record !== null) {
      const sealed = deps.store.readLease(subject);
      if (sealed !== null) {
        const verdict = verifyLease(
          { lease: sealed.leaseB64, sig: sealed.sig, keyId: sealed.keyId },
          { subject, deviceKeyId: record.keyId, keys },
        );
        if (verdict.ok) sealedLease = verdict.payload;
      }
    }
    const owed = deps.store.readCleanup(subject);
    return {
      subject,
      device: record === null ? null : infoOf(record),
      sealedLease,
      cleanupOwed: owed !== null && isRemovalReason(owed.reason) ? owed.reason : null,
      wall: deps.now(),
    };
  }

  function onSession(subject: string | null): void {
    if (!running) return;
    if (subject === machine.subject) return;
    if (subject === null) {
      record = null;
      lastStatus = null;
      dispatch({ t: 'signedOut' });
      return;
    }
    dispatch({ t: 'pair', pair: deps.host.pair(), allows: deps.account.allows() });
    dispatch({ t: 'signedIn', ...beginFor(subject) });
    if (lastStatus !== null) dispatch({ t: 'status', active: lastStatus });
  }

  function onPairOrAccount(): void {
    if (!running) return;
    dispatch({ t: 'pair', pair: deps.host.pair(), allows: deps.account.allows() });
  }

  function execute(effect: Effect, subject: string | null): void {
    switch (effect.e) {
      case 'ensureDevice':
        if (subject !== null) ensureDevice(subject);
        return;
      case 'forgetDevice':
        record = null;
        if (subject !== null) deps.store.clearDevice(subject);
        return;
      case 'saveDeviceId':
        if (subject !== null && record !== null) {
          record = { ...record, deviceId: effect.deviceId };
          deps.store.writeDevice(subject, record);
        }
        return;
      case 'fetchSalt':
        void fetchSalt();
        return;
      case 'activate':
        void deviceRequest(
          effect.move ? 'move' : 'activate',
          'licenceActivate',
          (fingerprintHex, r) => ({
            publicKey: r.publicKey,
            fingerprint: fingerprintHex,
            computerName: deps.identity.computerName(),
            move: effect.move,
          }),
          (token, signed) => deps.api.activateLicence(token, signed),
        );
        return;
      case 'renew':
        void deviceRequest(
          'renew',
          'lease',
          (fingerprintHex) => ({
            playing: deps.host.pair(),
            fingerprint: fingerprintHex,
            bundle: {
              sequence: deps.removal.runningSequence(),
              hostApi: PLUGIN_API_VERSION,
              appVersion: deps.appVersion,
              flavor: deps.flavor,
            },
          }),
          (token, signed) => deps.api.renewLease(token, signed),
        );
        return;
      case 'cleanup':
        void deviceRequest(
          'cleanup',
          'licenceCleanup',
          (fingerprintHex) => ({ fingerprint: fingerprintHex, removed: true }),
          (token, signed) => deps.api.reportCleanup(token, signed),
        );
        return;
      case 'arm':
        arm(effect.timer, effect.inMs);
        return;
      case 'disarm':
        clearTimer(effect.timer);
        return;
      case 'sealLease':
        if (subject !== null) deps.store.writeLease(subject, effect.seal);
        return;
      case 'markCleanupOwed':
        if (subject !== null && record !== null) deps.store.writeCleanup(subject, { keyId: record.keyId, reason: effect.reason });
        return;
      case 'clearCleanupOwed':
        if (subject !== null) deps.store.clearCleanup(subject);
        return;
      case 'requestRemoval':
        deps.removal.requestPremiumRemoval(effect.reason);
        return;
      case 'signOut':
        // The host already ended the session when it saw the refusal; nothing is left to do here.
        return;
      case 'publish':
        deps.onChanged(licenceView(machine));
        return;
      case 'log':
        if (effect.event === 'premium.licence_state') {
          deps.log.info({ scope: 'premium', event: effect.event, ...effect.fields });
        } else {
          deps.log.warn({ scope: 'premium', event: effect.event, ...effect.fields });
        }
        return;
    }
  }

  /** Generates and seals this user's key if there is none; the key is stored before anything is sent with it. */
  function ensureDevice(subject: string): void {
    if (!deps.secureStorage()) {
      dispatch({ t: 'identityFailed', reason: 'no_secure_storage' });
      return;
    }
    let held = deps.store.readDevice(subject);
    if (held === null) {
      held = generateDeviceRecord();
      if (deps.store.writeDevice(subject, held) === 'unavailable') {
        dispatch({ t: 'identityFailed', reason: 'no_secure_storage' });
        return;
      }
    }
    record = held;
    dispatch({ t: 'deviceReady', device: infoOf(held) });
  }

  async function fetchSalt(): Promise<void> {
    const generation = machine.generation;
    const subject = machine.subject;
    try {
      const answer = await deps.host.withBearer(
        (token) => deps.api.fetchLicenceSalt(token),
        (reply) => reply.outcome.kind === 'unauthorized',
      );
      if (answer === 'unauthorized') {
        finish('salt', generation, { outcome: { kind: 'unauthorized' }, dateMs: null }, null);
        return;
      }
      if (answer.outcome.kind === 'salt' && record !== null && subject !== null && generation === machine.generation) {
        // The salt is kept in the sealed device record and goes no further.
        record = { ...record, fingerprintSalt: answer.outcome.fingerprintSalt };
        deps.store.writeDevice(subject, record);
      }
      finish('salt', generation, answer, record);
    } catch {
      finish('salt', generation, { outcome: { kind: 'failed' }, dateMs: null }, null);
    }
  }

  async function deviceRequest(
    of: Exclude<RequestKind, 'salt'>,
    path: SignedPath,
    makeBody: (fingerprintHex: string, held: DeviceRecord) => unknown,
    send: (token: string, signed: DeviceSignedCall) => Promise<LicenceAnswer>,
  ): Promise<void> {
    const generation = machine.generation;
    const held = record;
    try {
      if (held === null) {
        finish(of, generation, { outcome: { kind: 'failed' }, dateMs: null }, null);
        return;
      }
      const guid = await deps.identity.machineGuid();
      if (generation !== machine.generation) return;
      if (guid === null || held.fingerprintSalt === null) {
        // Nothing is sent without a fingerprint.
        dispatch({ t: 'identityFailed', reason: 'no_fingerprint' });
        return;
      }
      // The body is serialised once; the same string is signed and sent.
      const body = JSON.stringify(makeBody(fingerprint(held.fingerprintSalt, guid), held));
      const device = deviceHeader({
        keyId: held.keyId,
        privateKey: held.privateKey,
        method: SIGNED_METHOD,
        path: PREMIUM_API_PATHS[path],
        body,
        nowMs: deps.now(),
        offsetMs,
      });
      const answer = await deps.host.withBearer(
        (token) => send(token, { device, body }),
        (reply) => reply.outcome.kind === 'unauthorized',
      );
      finish(
        of,
        generation,
        answer === 'unauthorized' ? { outcome: { kind: 'unauthorized' }, dateMs: null } : answer,
        held,
      );
    } catch {
      finish(of, generation, { outcome: { kind: 'failed' }, dateMs: null }, held);
    }
  }

  /** Turns what a route answered into the machine's outcome, judging a Lease on the way. */
  function decide(outcome: LicenceOutcome, held: DeviceRecord | null): Outcome {
    switch (outcome.kind) {
      case 'lease': {
        const subject = machine.subject;
        if (subject === null || held === null) return { kind: 'failed' };
        const verdict = verifyLease(outcome.envelope, { subject, deviceKeyId: held.keyId, keys });
        if (!verdict.ok) return { kind: 'leaseInvalid', check: verdict.check };
        return {
          kind: 'lease',
          payload: verdict.payload,
          windowMs: verdict.windowMs,
          seal: { leaseB64: outcome.envelope.lease, sig: outcome.envelope.sig, keyId: outcome.envelope.keyId },
          deviceId: outcome.deviceId,
        };
      }
      case 'salt':
        return { kind: 'salt' };
      default:
        return outcome;
    }
  }

  function finish(of: RequestKind, generation: number, answer: LicenceAnswer, held: DeviceRecord | null): void {
    if (!running) return;
    if (answer.dateMs !== null) offsetMs = answer.dateMs - deps.now();
    if (answer.outcome.kind === 'lease') {
      // One way only: the premium host decides what to do with it; no licence state depends on it.
      try {
        deps.removal.noteLatestSequence(answer.outcome.latestSequence);
      } catch {
        // A host that fails to take the note changes nothing here.
      }
    }
    dispatch({
      t: 'answer',
      of,
      generation,
      outcome: decide(answer.outcome, held),
      mono: deps.mono(),
      wall: deps.now(),
    });
  }

  const service: LicenceService = {
    start() {
      if (running || !deps.enabled) return;
      running = true;
      unsubscribes.push(
        deps.host.onSession(onSession),
        deps.host.onStatus((active) => {
          if (!running) return;
          lastStatus = active;
          dispatch({ t: 'status', active });
        }),
        deps.host.onPair(onPairOrAccount),
        deps.account.subscribe(onPairOrAccount),
      );
      deps.removal.attach(() => {
        service.noteFolderGone();
      });
      // The pair is told first: a start never resets it, and a renewal in flight must not be followed by a second.
      dispatch({ t: 'pair', pair: deps.host.pair(), allows: deps.account.allows() });
      dispatch({ t: 'started', enabled: true, ...beginFor(deps.host.subject()) });
    },

    stop() {
      if (!running) return;
      running = false;
      for (const stop of unsubscribes.splice(0)) stop();
      clearTimer('renew');
      clearTimer('window');
      queue.length = 0;
      record = null;
      gate.set(false, 'signed_out');
    },

    view: () => licenceView(machine),

    pressMove() {
      if (running) dispatch({ t: 'movePressed' });
    },

    trigger(why) {
      if (running) dispatch({ t: 'trigger', why });
    },

    noteFolderGone() {
      if (running) dispatch({ t: 'folderGone' });
    },
  };
  return service;
}
