import { describe, expect, it } from 'vitest';
import type { LeaseCheck, LeasePayload } from './lease-verify.js';
import {
  initialMachine,
  leaseGateOpen,
  licenceView,
  RENEW_EVERY_MS,
  RETRY_SCHEDULE_MS,
  step,
  type Begin,
  type DeviceInfo,
  type Effect,
  type Event,
  type Machine,
  type Outcome,
  type Pair,
  type RequestKind,
} from './licence-machine.js';

const M = 5_000;
const W = Date.parse('2026-10-30T12:00:00.000Z');
const YESTERDAY = '2026-10-29T12:00:00.000Z';
const TOMORROW = '2026-10-31T12:00:00.000Z';
const HOUR = 3_600_000;

const PAIR: Pair = { accountId: 'acc-1', steamId64: '76561198000000001' };
const OTHER_PAIR: Pair = { accountId: 'acc-2', steamId64: '76561198000000002' };
const DEVICE: DeviceInfo = { keyId: 'device-key', deviceId: 'device-1', hasSalt: true };
const UNLINKED: DeviceInfo = { keyId: 'device-key', deviceId: null, hasSalt: true };
const SEAL = { leaseB64: 'bGVhc2U', sig: 'c2ln', keyId: 'lCwiDkHw' };

function payload(over: Partial<LeasePayload> = {}): LeasePayload {
  return {
    v: 1,
    user: 'u1',
    deviceKeyId: 'device-key',
    state: 'active',
    playing: PAIR,
    until: null,
    issuedAt: '2026-10-30T11:00:00.000Z',
    expiresAt: '2026-10-30T12:00:00.000Z',
    minSequence: 0,
    ...over,
  };
}

/** A signed-in machine that has not heard from the API yet. */
function signedIn(over: Partial<Machine> = {}): Machine {
  return {
    ...initialMachine(true),
    subject: 'u1',
    generation: 1,
    device: DEVICE,
    premiumActive: true,
    state: 'unconfirmed',
    ...over,
  };
}

function holding(over: Partial<Machine> = {}): Machine {
  return signedIn({
    state: 'holds',
    lease: { payload: payload(), windowEndsMono: M + HOUR },
    lastUntil: null,
    ...over,
  });
}

/** A PC whose licence is gone and whose removal report is owed. */
function owing(reason: 'ended' | 'moved' | 'released', over: Partial<Machine> = {}): Machine {
  return signedIn({ state: reason, cleanup: { owed: reason, folderGone: false }, removalDone: false, ...over });
}

/** A PC whose licence is gone and whose removal report was answered. */
function gone(reason: 'ended' | 'moved' | 'released', over: Partial<Machine> = {}): Machine {
  return signedIn({ state: reason, removalDone: true, ...over });
}

const begin = (over: Partial<Begin> = {}): Begin => ({
  subject: 'u1',
  device: DEVICE,
  sealedLease: null,
  cleanupOwed: null,
  wall: W,
  ...over,
});

const answer = (of: RequestKind, outcome: Outcome, over: { generation?: number; mono?: number; wall?: number } = {}): Event => ({
  t: 'answer',
  of,
  generation: over.generation ?? 1,
  outcome,
  mono: over.mono ?? M,
  wall: over.wall ?? W,
});

const leaseOutcome = (over: Partial<LeasePayload> = {}, deviceId: string | null = null, windowMs = HOUR): Outcome => ({
  kind: 'lease',
  payload: payload(over),
  windowMs,
  seal: SEAL,
  deviceId,
});

const failed = (retryAfterSec?: number): Outcome =>
  retryAfterSec === undefined ? { kind: 'failed' } : { kind: 'failed', retryAfterSec };

const PUBLISH: Effect = { e: 'publish' };
const stateLog = (state: Machine['state'], reason?: NonNullable<Machine['reason']>): Effect => ({
  e: 'log',
  event: 'premium.licence_state',
  fields: reason === undefined ? { state } : { state, reason },
});
const rejectedLog = (check: LeaseCheck): Effect => ({ e: 'log', event: 'premium.lease_rejected', fields: { check } });
const DISARM_WINDOW: Effect = { e: 'disarm', timer: 'window' };
const DISARM_RENEW: Effect = { e: 'disarm', timer: 'renew' };
const armRenew = (inMs: number): Effect => ({ e: 'arm', timer: 'renew', inMs });
const armWindow = (inMs: number): Effect => ({ e: 'arm', timer: 'window', inMs });
const RENEW: Effect = { e: 'renew' };
const CLEANUP: Effect = { e: 'cleanup' };
const ACTIVATE: Effect = { e: 'activate', move: false };
const MOVE: Effect = { e: 'activate', move: true };
const ENSURE: Effect = { e: 'ensureDevice' };
const FORGET: Effect = { e: 'forgetDevice' };
const SALT: Effect = { e: 'fetchSalt' };
const SEAL_LEASE: Effect = { e: 'sealLease', seal: SEAL };
const CLEAR_OWED: Effect = { e: 'clearCleanupOwed' };
const owe = (reason: 'ended' | 'moved' | 'released'): Effect[] => [
  { e: 'markCleanupOwed', reason },
  { e: 'requestRemoval', reason },
];

interface Row {
  readonly name: string;
  readonly from: Machine;
  readonly event: Event;
  /** Fields that differ in the next machine (undefined: absent); every other field must be unchanged. */
  readonly next: { -readonly [K in keyof Machine]?: Machine[K] | undefined };
  readonly effects: readonly Effect[];
}

function check(row: Row): void {
  const out = step(row.from, row.event);
  expect(out.machine).toEqual({ ...row.from, ...row.next } as Machine);
  expect(out.effects).toEqual(row.effects);
}

function table(title: string, rows: readonly Row[]): void {
  describe(title, () => {
    it.each(rows.map((row) => [row.name, row] as const))('%s', (_name, row) => {
      check(row);
    });
  });
}

/** Feeds events in order, returning the final machine and every effect list. */
function run(from: Machine, events: readonly Event[]): { machine: Machine; effects: Effect[][] } {
  let machine = from;
  const effects: Effect[][] = [];
  for (const event of events) {
    const out = step(machine, event);
    machine = out.machine;
    effects.push([...out.effects]);
  }
  return { machine, effects };
}

// -- 1. A disabled flavour ---------------------------------------------------------------------

describe('rule 1: a disabled flavour ignores every event', () => {
  const off = initialMachine(false);
  const events: ReadonlyArray<readonly [string, Event]> = [
    ['started (still disabled)', { t: 'started', enabled: false, ...begin() }],
    ['signedIn', { t: 'signedIn', ...begin() }],
    ['signedOut', { t: 'signedOut' }],
    ['status', { t: 'status', active: true }],
    ['pair', { t: 'pair', pair: PAIR, allows: true }],
    ['trigger', { t: 'trigger', why: 'resume' }],
    ['movePressed', { t: 'movePressed' }],
    ['folderGone', { t: 'folderGone' }],
    ['windowEnded', { t: 'windowEnded', mono: M }],
    ['deviceReady', { t: 'deviceReady', device: DEVICE }],
    ['identityFailed', { t: 'identityFailed', reason: 'no_fingerprint' }],
    ['answer', answer('renew', leaseOutcome())],
  ];

  it.each(events)('%s changes nothing and does nothing', (_name, event) => {
    const out = step(off, event);
    expect(out.machine).toBe(off);
    expect(out.effects).toEqual([]);
  });

  it('stays signed out with no key, no request and a closed gate', () => {
    const out = step(off, { t: 'started', enabled: false, ...begin() });
    expect(out.machine.state).toBe('signed_out');
    expect(out.machine.device).toBeNull();
    expect(leaseGateOpen(out.machine, M, true)).toBe(false);
  });

  it('is enabled by a start that says so, and a start with no one signed in sends nothing', () => {
    check({
      name: '',
      from: off,
      event: { t: 'started', enabled: true, ...begin({ subject: null, device: null }) },
      next: { enabled: true, generation: 1 },
      effects: [],
    });
  });
});

// -- 2. Stale answers ----------------------------------------------------------------------------

describe('rule 2: stale answers are dropped', () => {
  it('drops an answer issued under an older generation', () => {
    const from = signedIn({ generation: 2, inFlight: 'renew' });
    const out = step(from, answer('renew', leaseOutcome(), { generation: 1 }));
    expect(out.machine).toEqual(from);
    expect(out.effects).toEqual([]);
  });

  it('drops an answer that arrives after sign-out', () => {
    const { machine, effects } = run(signedIn({ inFlight: 'renew' }), [
      { t: 'signedOut' },
      answer('renew', leaseOutcome()),
    ]);
    expect(machine.state).toBe('signed_out');
    expect(machine.lease).toBeNull();
    expect(effects[1]).toEqual([]);
  });

  it('drops an answer for a request that is not in flight', () => {
    const from = signedIn({ inFlight: null });
    const out = step(from, answer('renew', leaseOutcome()));
    expect(out.machine).toEqual(from);
    expect(out.effects).toEqual([]);
  });

  it('drops an answer of another kind than the request in flight', () => {
    const from = signedIn({ inFlight: 'salt', device: { ...DEVICE, hasSalt: false } });
    const out = step(from, answer('renew', leaseOutcome()));
    expect(out.machine).toEqual(from);
    expect(out.effects).toEqual([]);
  });

  it('drops the answer to a Move when the user signs out during it, and stores nothing', () => {
    const pressing = signedIn({ state: 'elsewhere', device: UNLINKED, holderName: 'PC-B' });
    const { machine, effects } = run(pressing, [
      { t: 'movePressed' },
      { t: 'signedOut' },
      answer('move', leaseOutcome({}, 'device-9')),
    ]);
    expect(effects[0]).toContainEqual(MOVE);
    expect(machine.state).toBe('signed_out');
    expect(machine.lease).toBeNull();
    expect(machine.moveIntent).toBe(false);
    expect(effects[2]).toEqual([]);
    for (const list of effects) {
      expect(list.map((e) => e.e)).not.toContain('sealLease');
      expect(list.map((e) => e.e)).not.toContain('saveDeviceId');
    }
  });
});

// -- 3. Start and sign-in ----------------------------------------------------------------------------

table('rules 4, 5, 12: start and sign-in', [
  {
    name: 'a start with a linked device asks for a renewal at once',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin() },
    next: { subject: 'u1', generation: 1, device: DEVICE, inFlight: 'renew', state: 'unconfirmed' },
    effects: [DISARM_WINDOW, DISARM_RENEW, RENEW, stateLog('unconfirmed'), PUBLISH],
  },
  {
    name: 'a start with no device record makes one first',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ device: null }) },
    next: { subject: 'u1', generation: 1, device: null, inFlight: 'ensure', state: 'unconfirmed' },
    effects: [DISARM_WINDOW, DISARM_RENEW, ENSURE, stateLog('unconfirmed'), PUBLISH],
  },
  {
    name: 'a start with a device that has no salt fetches the salt before anything else',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ device: { keyId: 'device-key', deviceId: null, hasSalt: false } }) },
    next: {
      subject: 'u1',
      generation: 1,
      device: { keyId: 'device-key', deviceId: null, hasSalt: false },
      inFlight: 'salt',
      state: 'unconfirmed',
    },
    effects: [DISARM_WINDOW, DISARM_RENEW, SALT, stateLog('unconfirmed'), PUBLISH],
  },
  {
    name: 'a start with a salted device that never activated waits for the status before activating',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ device: UNLINKED }) },
    next: { subject: 'u1', generation: 1, device: UNLINKED, state: 'unconfirmed' },
    effects: [DISARM_WINDOW, DISARM_RENEW, stateLog('unconfirmed'), PUBLISH],
  },
  {
    name: 'a sealed active Lease never restores holds: the state starts unconfirmed and only its end date is kept',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ sealedLease: payload({ until: TOMORROW }) }) },
    next: { subject: 'u1', generation: 1, device: DEVICE, inFlight: 'renew', state: 'unconfirmed', lastUntil: TOMORROW },
    effects: [DISARM_WINDOW, DISARM_RENEW, RENEW, stateLog('unconfirmed'), PUBLISH],
  },
  {
    name: 'a sealed moved Lease brings back the moved state and the holder name, removal already done',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ sealedLease: payload({ state: 'moved', holderName: 'PC-B' }) }) },
    next: {
      subject: 'u1',
      generation: 1,
      device: DEVICE,
      inFlight: 'renew',
      state: 'moved',
      holderName: 'PC-B',
      lastUntil: null,
      removalDone: true,
    },
    effects: [DISARM_WINDOW, DISARM_RENEW, RENEW, stateLog('moved'), PUBLISH],
  },
  {
    name: 'a start with a cleanup marker asks the host to remove again and sends no renewal',
    from: initialMachine(true),
    event: {
      t: 'started',
      enabled: true,
      ...begin({ sealedLease: payload({ state: 'moved', holderName: 'PC-B' }), cleanupOwed: 'moved' }),
    },
    next: {
      subject: 'u1',
      generation: 1,
      device: DEVICE,
      state: 'moved',
      holderName: 'PC-B',
      lastUntil: null,
      cleanup: { owed: 'moved', folderGone: false },
    },
    effects: [DISARM_WINDOW, DISARM_RENEW, { e: 'requestRemoval', reason: 'moved' }, stateLog('moved'), PUBLISH],
  },
  {
    name: 'a sealed Lease whose end date has passed ends at start and starts removal, with no renewal',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ sealedLease: payload({ until: YESTERDAY }) }) },
    next: {
      subject: 'u1',
      generation: 1,
      device: DEVICE,
      state: 'ended',
      lastUntil: YESTERDAY,
      cleanup: { owed: 'ended', folderGone: false },
    },
    effects: [DISARM_WINDOW, DISARM_RENEW, ...owe('ended'), stateLog('ended'), PUBLISH],
  },
  {
    name: 'a sealed Lease with no end date never ends by date: the start only pauses',
    from: initialMachine(true),
    event: { t: 'started', enabled: true, ...begin({ sealedLease: payload({ until: null }) }) },
    next: { subject: 'u1', generation: 1, device: DEVICE, inFlight: 'renew', state: 'unconfirmed', lastUntil: null },
    effects: [DISARM_WINDOW, DISARM_RENEW, RENEW, stateLog('unconfirmed'), PUBLISH],
  },
  {
    name: 'a sign-in with a cleanup marker keeps the removal owed and renews nothing',
    from: initialMachine(true),
    event: { t: 'signedIn', ...begin({ cleanupOwed: 'released' }) },
    next: { subject: 'u1', generation: 1, device: DEVICE, state: 'released', cleanup: { owed: 'released', folderGone: false } },
    effects: [DISARM_WINDOW, DISARM_RENEW, { e: 'requestRemoval', reason: 'released' }, stateLog('released'), PUBLISH],
  },
  {
    name: 'a sign-in over another subject drops that subject and starts the new one',
    from: holding({ subject: 'u0', generation: 3 }),
    event: { t: 'signedIn', ...begin() },
    next: { subject: 'u1', generation: 4, lease: null, inFlight: 'renew', state: 'unconfirmed', lastUntil: undefined, premiumActive: null },
    effects: [DISARM_WINDOW, DISARM_RENEW, RENEW, stateLog('unconfirmed'), PUBLISH],
  },
]);

describe('sign-out', () => {
  it('resets everything in memory, disarms both timers and bumps the generation', () => {
    const out = step(holding({ pair: PAIR, premiumActive: true }), { t: 'signedOut' });
    expect(out.machine).toEqual({
      ...initialMachine(true),
      generation: 2,
    });
    expect(out.effects).toEqual([DISARM_WINDOW, DISARM_RENEW, stateLog('signed_out'), PUBLISH]);
  });

  it('leaves a cleanup marker alone: no effect clears it', () => {
    const out = step(owing('moved'), { t: 'signedOut' });
    expect(out.effects.map((e) => e.e)).not.toContain('clearCleanupOwed');
    expect(out.machine.cleanup).toEqual({ owed: null, folderGone: false });
  });

  it('is quiet when no one was signed in', () => {
    check({
      name: '',
      from: initialMachine(true),
      event: { t: 'signedOut' },
      next: { generation: 1 },
      effects: [],
    });
  });
});

// -- 4. Identity -----------------------------------------------------------------------------------------

describe('rule 4: identity first', () => {
  it('walks make-device, fetch-salt, activate in that order, one request at a time', () => {
    const { machine, effects } = run(initialMachine(true), [
      { t: 'started', enabled: true, ...begin({ device: null }) },
      { t: 'status', active: true },
      { t: 'deviceReady', device: { keyId: 'new-key', deviceId: null, hasSalt: false } },
      answer('salt', { kind: 'salt' }),
    ]);
    expect(effects[0]).toContainEqual(ENSURE);
    expect(effects[1]).toEqual([]);
    expect(effects[2]).toEqual([SALT]);
    expect(effects[3]).toEqual([ACTIVATE]);
    expect(machine.inFlight).toBe('activate');
    expect(machine.device).toEqual({ keyId: 'new-key', deviceId: null, hasSalt: true });
  });

  it('does not follow an activation with a second one when the status arrives during the identity steps', () => {
    const { machine, effects } = run(initialMachine(true), [
      { t: 'started', enabled: true, ...begin({ device: null }) },
      { t: 'status', active: true },
      { t: 'deviceReady', device: { keyId: 'new-key', deviceId: null, hasSalt: false } },
      { t: 'status', active: true },
      answer('salt', { kind: 'salt' }),
      answer('activate', { kind: 'failed' }),
    ]);
    expect(effects.flat().filter((e) => e.e === 'activate')).toHaveLength(1);
    expect(machine.followUp).toBe(false);
    expect(machine.inFlight).toBeNull();
  });

  it('ignores a device that was not asked for', () => {
    const from = signedIn({ inFlight: null });
    const out = step(from, { t: 'deviceReady', device: DEVICE });
    expect(out.machine).toEqual(from);
    expect(out.effects).toEqual([]);
  });

  table('identity failures send no request', [
    {
      name: 'no secure storage: unconfirmed with its reason, nothing armed',
      from: signedIn({ device: null, inFlight: 'ensure' }),
      event: { t: 'identityFailed', reason: 'no_secure_storage' },
      next: { inFlight: null, state: 'unconfirmed', reason: 'no_secure_storage' },
      effects: [stateLog('unconfirmed', 'no_secure_storage'), PUBLISH],
    },
    {
      name: 'no fingerprint: unconfirmed with its reason and a retry on the schedule',
      from: signedIn({ inFlight: 'renew' }),
      event: { t: 'identityFailed', reason: 'no_fingerprint' },
      next: { inFlight: null, state: 'unconfirmed', reason: 'no_fingerprint', retryStep: 1 },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'no_fingerprint'), PUBLISH],
    },
    {
      name: 'no fingerprint on a holder: unconfirmed, the Lease stays until it runs out',
      from: holding({ inFlight: 'renew' }),
      event: { t: 'identityFailed', reason: 'no_fingerprint' },
      next: { inFlight: null, state: 'unconfirmed', reason: 'no_fingerprint', retryStep: 1 },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'no_fingerprint'), PUBLISH],
    },
    {
      name: 'no fingerprint while a removal report is owed: the state stays, the retry is armed',
      from: owing('moved', { inFlight: 'cleanup', cleanup: { owed: 'moved', folderGone: true } }),
      event: { t: 'identityFailed', reason: 'no_fingerprint' },
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'no fingerprint on a pressed Move: the press is over and the state is unconfirmed',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', moveIntent: true, inFlight: 'move', device: UNLINKED }),
      event: { t: 'identityFailed', reason: 'no_fingerprint' },
      next: {
        inFlight: null,
        moveIntent: false,
        state: 'unconfirmed',
        reason: 'no_fingerprint',
        holderName: undefined,
        retryStep: 1,
      },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'no_fingerprint'), PUBLISH],
    },
  ]);
});

// -- 5. Activate or renew, status -------------------------------------------------------------------------

table('rule 5: activate or renew, and what the status may do', [
  {
    name: 'status active with no deviceId activates without a press (move: false)',
    from: signedIn({ device: UNLINKED, premiumActive: null }),
    event: { t: 'status', active: true },
    next: { premiumActive: true, inFlight: 'activate' },
    effects: [ACTIVATE],
  },
  {
    name: 'status inactive never activates: it marks the licence inactive',
    from: signedIn({ device: UNLINKED, premiumActive: null }),
    event: { t: 'status', active: false },
    next: { premiumActive: false, state: 'inactive' },
    effects: [stateLog('inactive'), PUBLISH],
  },
  {
    name: 'status active while inactive and never activated activates',
    from: signedIn({ state: 'inactive', device: UNLINKED, premiumActive: false }),
    event: { t: 'status', active: true },
    next: { premiumActive: true, inFlight: 'activate' },
    effects: [ACTIVATE],
  },
  {
    name: 'status active while inactive on a linked PC renews',
    from: signedIn({ state: 'inactive', premiumActive: false }),
    event: { t: 'status', active: true },
    next: { premiumActive: true, inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'status active while ended (Premium returned) renews, it does not activate',
    from: gone('ended', { premiumActive: false }),
    event: { t: 'status', active: true },
    next: { premiumActive: true, inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'status inactive on a holder renews at once and never changes the state (the Lease decides)',
    from: holding(),
    event: { t: 'status', active: false },
    next: { premiumActive: false, inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'status inactive on a holder during a request waits one follow-up and changes nothing else',
    from: holding({ inFlight: 'renew' }),
    event: { t: 'status', active: false },
    next: { premiumActive: false, followUp: true },
    effects: [],
  },
  {
    name: 'status active that agrees with a holder does nothing',
    from: holding(),
    event: { t: 'status', active: true },
    next: {},
    effects: [],
  },
  {
    name: 'the first status on a linked PC does not add a request to the start renewal',
    from: signedIn({ premiumActive: null }),
    event: { t: 'status', active: true },
    next: { premiumActive: true },
    effects: [],
  },
  {
    name: 'status inactive on a linked, paused PC does not end it',
    from: signedIn({ premiumActive: true }),
    event: { t: 'status', active: false },
    next: { premiumActive: false },
    effects: [],
  },
  {
    name: 'status flips while a removal report is owed send nothing (rule 3 beats rule 11)',
    from: owing('moved', { premiumActive: false }),
    event: { t: 'status', active: true },
    next: { premiumActive: true },
    effects: [],
  },
  {
    name: 'a status with no one signed in is ignored',
    from: initialMachine(true),
    event: { t: 'status', active: true },
    next: {},
    effects: [],
  },
]);

// -- 6. Answers -------------------------------------------------------------------------------------------

describe('rule 6: answers', () => {
  table('an accepted Lease', [
    {
      name: 'active on a renewal: holds, window and 15-minute renewal armed, Lease sealed',
      from: signedIn({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome()),
      next: { inFlight: null, state: 'holds', lease: { payload: payload(), windowEndsMono: M + HOUR }, lastUntil: null },
      effects: [SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
    {
      name: 'paused_other_account is holds too (the banner explains the pause)',
      from: signedIn({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({ state: 'paused_other_account', playing: OTHER_PAIR })),
      next: {
        inFlight: null,
        state: 'holds',
        lease: { payload: payload({ state: 'paused_other_account', playing: OTHER_PAIR }), windowEndsMono: M + HOUR },
        lastUntil: null,
      },
      effects: [SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
    {
      name: 'a shorter Lease arms a shorter window',
      from: signedIn({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({}, null, 20 * 60_000)),
      next: { inFlight: null, state: 'holds', lease: { payload: payload(), windowEndsMono: M + 20 * 60_000 }, lastUntil: null },
      effects: [SEAL_LEASE, armWindow(20 * 60_000), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
    {
      name: 'an activation Lease stores the device id',
      from: signedIn({ device: UNLINKED, inFlight: 'activate' }),
      event: answer('activate', leaseOutcome({}, 'device-9')),
      next: {
        device: { ...UNLINKED, deviceId: 'device-9' },
        inFlight: null,
        state: 'holds',
        lease: { payload: payload(), windowEndsMono: M + HOUR },
        lastUntil: null,
      },
      effects: [
        { e: 'saveDeviceId', deviceId: 'device-9' },
        SEAL_LEASE,
        armWindow(HOUR),
        armRenew(RENEW_EVERY_MS),
        stateLog('holds'),
        PUBLISH,
      ],
    },
    {
      name: 'a renewal Lease for an already linked PC saves no device id',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({}, 'device-1')),
      next: { inFlight: null, lease: { payload: payload(), windowEndsMono: M + HOUR } },
      effects: [SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS)],
    },
    {
      name: 'a success resets the retry schedule',
      from: signedIn({ inFlight: 'renew', retryStep: 3 }),
      event: answer('renew', leaseOutcome()),
      next: {
        inFlight: null,
        retryStep: 0,
        state: 'holds',
        lease: { payload: payload(), windowEndsMono: M + HOUR },
        lastUntil: null,
      },
      effects: [SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
    {
      name: 'the Lease end date is remembered',
      from: signedIn({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({ until: TOMORROW })),
      next: {
        inFlight: null,
        state: 'holds',
        lease: { payload: payload({ until: TOMORROW }), windowEndsMono: M + HOUR },
        lastUntil: TOMORROW,
      },
      effects: [SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
  ]);

  table('a Lease that says the licence left (rule 6, removal)', [
    {
      name: 'moved: moved with the holder name, marker sealed then removal asked, window disarmed',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({ state: 'moved', holderName: 'PC-B' })),
      next: {
        inFlight: null,
        state: 'moved',
        holderName: 'PC-B',
        lease: { payload: payload({ state: 'moved', holderName: 'PC-B' }), windowEndsMono: M + HOUR },
        cleanup: { owed: 'moved', folderGone: false },
      },
      effects: [SEAL_LEASE, DISARM_WINDOW, armRenew(RENEW_EVERY_MS), ...owe('moved'), stateLog('moved'), PUBLISH],
    },
    {
      name: 'released: released, marker then removal',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({ state: 'released' })),
      next: {
        inFlight: null,
        state: 'released',
        lease: { payload: payload({ state: 'released' }), windowEndsMono: M + HOUR },
        cleanup: { owed: 'released', folderGone: false },
      },
      effects: [SEAL_LEASE, DISARM_WINDOW, armRenew(RENEW_EVERY_MS), ...owe('released'), stateLog('released'), PUBLISH],
    },
    {
      name: 'ended: ended, marker then removal',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({ state: 'ended' })),
      next: {
        inFlight: null,
        state: 'ended',
        lease: { payload: payload({ state: 'ended' }), windowEndsMono: M + HOUR },
        cleanup: { owed: 'ended', folderGone: false },
      },
      effects: [SEAL_LEASE, DISARM_WINDOW, armRenew(RENEW_EVERY_MS), ...owe('ended'), stateLog('ended'), PUBLISH],
    },
    {
      name: 'moved while this PC was offline and paused: it learns at its next contact and removes',
      from: signedIn({ inFlight: 'renew', lastUntil: null }),
      event: answer('renew', leaseOutcome({ state: 'moved', holderName: 'PC-B' })),
      next: {
        inFlight: null,
        state: 'moved',
        holderName: 'PC-B',
        lease: { payload: payload({ state: 'moved', holderName: 'PC-B' }), windowEndsMono: M + HOUR },
        cleanup: { owed: 'moved', folderGone: false },
      },
      effects: [SEAL_LEASE, DISARM_WINDOW, armRenew(RENEW_EVERY_MS), ...owe('moved'), stateLog('moved'), PUBLISH],
    },
    {
      name: 'the same state again after the report was answered does not owe a second report',
      from: gone('moved', { holderName: 'PC-B', inFlight: 'renew' }),
      event: answer('renew', leaseOutcome({ state: 'moved', holderName: 'PC-B' })),
      next: {
        inFlight: null,
        lease: { payload: payload({ state: 'moved', holderName: 'PC-B' }), windowEndsMono: M + HOUR },
        lastUntil: null,
      },
      effects: [SEAL_LEASE, DISARM_WINDOW, armRenew(RENEW_EVERY_MS)],
    },
    {
      name: 'Premium returning to the last PC: an active Lease leaves ended with no Move',
      from: gone('ended', { inFlight: 'renew', premiumActive: true }),
      event: answer('renew', leaseOutcome()),
      next: { inFlight: null, state: 'holds', lease: { payload: payload(), windowEndsMono: M + HOUR }, lastUntil: null, removalDone: false },
      effects: [SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
  ]);

  table('refusals', [
    {
      name: 'held_elsewhere: elsewhere with the holder name and the next Move date',
      from: signedIn({ device: UNLINKED, inFlight: 'activate' }),
      event: answer('activate', { kind: 'heldElsewhere', holderName: 'PC-B', nextMoveAt: TOMORROW }),
      next: { inFlight: null, state: 'elsewhere', holderName: 'PC-B', nextMoveAt: TOMORROW },
      effects: [DISARM_WINDOW, stateLog('elsewhere'), PUBLISH],
    },
    {
      name: 'held_elsewhere with no Move date carries none',
      from: signedIn({ device: UNLINKED, inFlight: 'activate' }),
      event: answer('activate', { kind: 'heldElsewhere', holderName: 'PC-B', nextMoveAt: null }),
      next: { inFlight: null, state: 'elsewhere', holderName: 'PC-B' },
      effects: [DISARM_WINDOW, stateLog('elsewhere'), PUBLISH],
    },
    {
      name: 'device_mismatch on a renewal: mismatch, and the held Lease is dropped',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', { kind: 'mismatch' }),
      next: { inFlight: null, state: 'mismatch', lease: null },
      effects: [DISARM_WINDOW, stateLog('mismatch'), PUBLISH],
    },
    {
      name: 'premium_inactive on activation: inactive',
      from: signedIn({ device: UNLINKED, inFlight: 'activate' }),
      event: answer('activate', { kind: 'premiumInactive' }),
      next: { inFlight: null, state: 'inactive' },
      effects: [DISARM_WINDOW, stateLog('inactive'), PUBLISH],
    },
    {
      name: 'device_signature on a renewal: unconfirmed with its reason, Lease kept, retry on the schedule',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', { kind: 'deviceSignature' }),
      next: { inFlight: null, state: 'unconfirmed', reason: 'device_signature', retryStep: 1 },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'device_signature'), PUBLISH],
    },
    {
      name: 'a bearer 401 runs the sign-out path and changes no state itself',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', { kind: 'unauthorized' }),
      next: { inFlight: null },
      effects: [{ e: 'signOut' }],
    },
    {
      name: 'device_foreign on a renewal: the key is forgotten, a new one is made, the Lease dropped',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', { kind: 'foreign' }),
      next: { inFlight: 'ensure', device: null, lease: null, state: 'unconfirmed', reason: 'network', foreignRetried: true },
      effects: [DISARM_WINDOW, FORGET, ENSURE, stateLog('unconfirmed', 'network'), PUBLISH],
    },
    {
      name: 'device_foreign on a removal report: the key is forgotten and the unanswerable marker cleared',
      from: owing('moved', { inFlight: 'cleanup', cleanup: { owed: 'moved', folderGone: true }, removalDone: true }),
      event: answer('cleanup', { kind: 'foreign' }),
      next: { inFlight: 'ensure', device: null, cleanup: { owed: null, folderGone: false }, foreignRetried: true },
      effects: [DISARM_WINDOW, FORGET, CLEAR_OWED, ENSURE],
    },
    {
      name: 'a second device_foreign in a row forgets the key but waits for the first retry step instead of starting again',
      from: holding({ inFlight: 'renew', foreignRetried: true }),
      event: answer('renew', { kind: 'foreign' }),
      next: { inFlight: null, device: null, lease: null, state: 'unconfirmed', reason: 'network', retryStep: 1 },
      effects: [DISARM_WINDOW, FORGET, armRenew(60_000), stateLog('unconfirmed', 'network'), PUBLISH],
    },
    {
      name: 'a third device_foreign in a row waits for the next retry step',
      from: signedIn({ device: UNLINKED, inFlight: 'activate', foreignRetried: true, retryStep: 1 }),
      event: answer('activate', { kind: 'foreign' }),
      next: { inFlight: null, device: null, retryStep: 2 },
      effects: [DISARM_WINDOW, FORGET, armRenew(120_000)],
    },
    {
      name: 'an accepted Lease gives the one immediate restart back',
      from: signedIn({ device: UNLINKED, inFlight: 'activate', foreignRetried: true }),
      event: answer('activate', leaseOutcome({}, 'device-1')),
      next: {
        inFlight: null,
        state: 'holds',
        lease: { payload: payload(), windowEndsMono: M + HOUR },
        lastUntil: null,
        foreignRetried: false,
        device: { ...UNLINKED, deviceId: 'device-1' },
      },
      effects: [{ e: 'saveDeviceId', deviceId: 'device-1' }, SEAL_LEASE, armWindow(HOUR), armRenew(RENEW_EVERY_MS), stateLog('holds'), PUBLISH],
    },
  ]);

  table('the removal report and the salt', [
    {
      name: 'cleanup confirmed: marker cleared, then the renewals resume',
      from: owing('moved', { inFlight: 'cleanup', cleanup: { owed: 'moved', folderGone: true }, removalDone: true, retryStep: 2 }),
      event: answer('cleanup', { kind: 'cleanup', result: 'confirmed' }),
      next: { inFlight: 'renew', cleanup: { owed: null, folderGone: false }, retryStep: 0 },
      effects: [CLEAR_OWED, RENEW],
    },
    {
      name: 'cleanup lapsed counts as answered',
      from: owing('ended', { inFlight: 'cleanup', cleanup: { owed: 'ended', folderGone: true }, removalDone: true }),
      event: answer('cleanup', { kind: 'cleanup', result: 'lapsed' }),
      next: { inFlight: 'renew', cleanup: { owed: null, folderGone: false } },
      effects: [CLEAR_OWED, RENEW],
    },
    {
      name: 'not_left: the report was premature, the marker is cleared and the PC renews',
      from: owing('ended', { inFlight: 'cleanup', cleanup: { owed: 'ended', folderGone: true }, removalDone: true }),
      event: answer('cleanup', { kind: 'notLeft' }),
      next: { inFlight: 'renew', cleanup: { owed: null, folderGone: false } },
      effects: [CLEAR_OWED, RENEW],
    },
    {
      name: 'a report answered 503 (failed) keeps the marker and retries on the schedule',
      from: owing('moved', { inFlight: 'cleanup', cleanup: { owed: 'moved', folderGone: true }, removalDone: true }),
      event: answer('cleanup', failed()),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'a report answered device_mismatch is a failed try, not a state',
      from: owing('moved', { inFlight: 'cleanup', cleanup: { owed: 'moved', folderGone: true }, removalDone: true }),
      event: answer('cleanup', { kind: 'mismatch' }),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'the salt arrives: the device has it, and activation follows',
      from: signedIn({ device: { ...UNLINKED, hasSalt: false }, inFlight: 'salt' }),
      event: answer('salt', { kind: 'salt' }),
      next: { device: UNLINKED, inFlight: 'activate' },
      effects: [ACTIVATE],
    },
    {
      name: 'the salt arrives before the status: nothing is sent yet',
      from: signedIn({ device: { ...UNLINKED, hasSalt: false }, inFlight: 'salt', premiumActive: null }),
      event: answer('salt', { kind: 'salt' }),
      next: { device: UNLINKED, inFlight: null },
      effects: [],
    },
    {
      name: 'a failed salt retries on the schedule',
      from: signedIn({ device: { ...UNLINKED, hasSalt: false }, inFlight: 'salt' }),
      event: answer('salt', failed()),
      next: { inFlight: null, retryStep: 1, reason: 'network' },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'network'), PUBLISH],
    },
  ]);
});

// -- 7. Failures and the retry schedule ------------------------------------------------------------------

describe('rule 6 and the retry schedule', () => {
  table('a failed or invalid answer keeps the Lease', [
    {
      name: 'a failed renewal keeps the Lease and the state, and retries in 1 minute',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', failed()),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'with no Lease the state is unconfirmed, reason network',
      from: signedIn({ inFlight: 'renew' }),
      event: answer('renew', failed()),
      next: { inFlight: null, retryStep: 1, reason: 'network' },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'network'), PUBLISH],
    },
    {
      name: 'a failed activation is the same',
      from: signedIn({ device: UNLINKED, inFlight: 'activate' }),
      event: answer('activate', failed()),
      next: { inFlight: null, retryStep: 1, reason: 'network' },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'network'), PUBLISH],
    },
    {
      name: 'a Lease that fails a check is logged by check name and counts as a failed renewal',
      from: holding({ inFlight: 'renew' }),
      event: answer('renew', { kind: 'leaseInvalid', check: 'signature' }),
      next: { inFlight: null, retryStep: 1 },
      effects: [rejectedLog('signature'), armRenew(60_000)],
    },
    {
      name: 'with no Lease an invalid one is unconfirmed, reason lease_invalid',
      from: signedIn({ inFlight: 'renew' }),
      event: answer('renew', { kind: 'leaseInvalid', check: 'device' }),
      next: { inFlight: null, retryStep: 1, reason: 'lease_invalid' },
      effects: [rejectedLog('device'), armRenew(60_000), stateLog('unconfirmed', 'lease_invalid'), PUBLISH],
    },
    {
      name: 'a failure never changes a removal state',
      from: gone('moved', { holderName: 'PC-B', inFlight: 'renew' }),
      event: answer('renew', failed()),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'a failure that finds a follow-up waiting sends it after arming the retry',
      from: holding({ inFlight: 'renew', followUp: true }),
      event: answer('renew', failed()),
      next: { inFlight: 'renew', followUp: false, retryStep: 1 },
      effects: [armRenew(60_000), RENEW],
    },
  ]);

  it('gives the delays 1, 2, 5, 15, 15 minutes over consecutive failures', () => {
    let machine = holding({ inFlight: 'renew' });
    const armed: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const failedStep = step(machine, answer('renew', failed()));
      const arm = failedStep.effects.find((e) => e.e === 'arm');
      armed.push(arm?.inMs ?? -1);
      machine = step(failedStep.machine, { t: 'trigger', why: 'timer' }).machine;
    }
    expect(armed).toEqual([60_000, 120_000, 300_000, 900_000, 900_000]);
    expect([...RETRY_SCHEDULE_MS]).toEqual([60_000, 120_000, 300_000, 900_000]);
  });

  it('stays at 15 minutes for every later failure', () => {
    const out = step(holding({ inFlight: 'renew', retryStep: 3 }), answer('renew', failed()));
    expect(out.effects).toEqual([armRenew(900_000)]);
    expect(out.machine.retryStep).toBe(3);
  });

  it('lets a larger Retry-After win over the schedule', () => {
    const out = step(holding({ inFlight: 'renew' }), answer('renew', failed(120)));
    expect(out.effects).toEqual([armRenew(120_000)]);
  });

  it('keeps the scheduled delay when Retry-After is smaller', () => {
    const out = step(holding({ inFlight: 'renew', retryStep: 2 }), answer('renew', failed(30)));
    expect(out.effects).toEqual([armRenew(300_000)]);
  });

  it('starts over at one minute after a success', () => {
    const { machine } = run(holding({ inFlight: 'renew', retryStep: 3 }), [answer('renew', leaseOutcome())]);
    expect(machine.retryStep).toBe(0);
    const next = step({ ...machine, inFlight: 'renew' }, answer('renew', failed()));
    expect(next.effects).toEqual([armRenew(60_000)]);
  });

  it('renews on the timer and again on every retry timer', () => {
    const out = step(holding(), { t: 'trigger', why: 'timer' });
    expect(out.effects).toEqual([RENEW]);
  });
});

// -- 8. The window end ---------------------------------------------------------------------------------------

describe('rule 8: the window end', () => {
  table('windowEnded', [
    {
      name: 'at the window end with no newer Lease: the Lease is gone and the state unconfirmed',
      from: holding(),
      event: { t: 'windowEnded', mono: M + HOUR },
      next: { lease: null, state: 'unconfirmed', reason: 'network' },
      effects: [stateLog('unconfirmed', 'network'), PUBLISH],
    },
    {
      name: 'a window-end event from an earlier Lease does not end a newer one',
      from: holding(),
      event: { t: 'windowEnded', mono: M + HOUR - 1 },
      next: {},
      effects: [],
    },
    {
      name: 'on a removal state the Lease is dropped and the state stays',
      from: gone('moved', { lease: { payload: payload({ state: 'moved' }), windowEndsMono: M + HOUR } }),
      event: { t: 'windowEnded', mono: M + HOUR },
      next: { lease: null },
      effects: [],
    },
    {
      name: 'with no Lease there is nothing to end',
      from: signedIn(),
      event: { t: 'windowEnded', mono: M + HOUR },
      next: {},
      effects: [],
    },
  ]);

  it('a renewal answer that arrived first wins over the stale window end of the Lease it replaced', () => {
    const { machine } = run(holding({ inFlight: 'renew' }), [
      answer('renew', leaseOutcome(), { mono: M + HOUR }),
      { t: 'windowEnded', mono: M + HOUR },
    ]);
    expect(machine.state).toBe('holds');
    expect(machine.lease?.windowEndsMono).toBe(M + 2 * HOUR);
  });

  it('a window end that came first leaves the PC paused until the answer, which then restores holds', () => {
    const { machine, effects } = run(holding({ inFlight: 'renew' }), [
      { t: 'windowEnded', mono: M + HOUR },
      answer('renew', leaseOutcome(), { mono: M + HOUR }),
    ]);
    expect(effects[0]).toEqual([stateLog('unconfirmed', 'network'), PUBLISH]);
    expect(machine.state).toBe('holds');
  });
});

// -- 9. Offline past the known end ---------------------------------------------------------------------------

describe('rule 7: offline past the known Premium end', () => {
  table('on a failed renewal', [
    {
      name: 'past the end date: ended, Lease dropped, timers disarmed, removal started',
      from: holding({ inFlight: 'renew', lastUntil: YESTERDAY }),
      event: answer('renew', failed()),
      next: { inFlight: null, state: 'ended', lease: null, cleanup: { owed: 'ended', folderGone: false } },
      effects: [DISARM_WINDOW, DISARM_RENEW, ...owe('ended'), stateLog('ended'), PUBLISH],
    },
    {
      name: 'a paused PC past the end date ends as well',
      from: signedIn({ inFlight: 'renew', lastUntil: YESTERDAY }),
      event: answer('renew', failed()),
      next: { inFlight: null, state: 'ended', cleanup: { owed: 'ended', folderGone: false } },
      effects: [DISARM_WINDOW, DISARM_RENEW, ...owe('ended'), stateLog('ended'), PUBLISH],
    },
    {
      name: 'an invalid Lease counts as a failure for this rule too',
      from: holding({ inFlight: 'renew', lastUntil: YESTERDAY }),
      event: answer('renew', { kind: 'leaseInvalid', check: 'lifetime' }),
      next: { inFlight: null, state: 'ended', lease: null, cleanup: { owed: 'ended', folderGone: false } },
      effects: [rejectedLog('lifetime'), DISARM_WINDOW, DISARM_RENEW, ...owe('ended'), stateLog('ended'), PUBLISH],
    },
    {
      name: 'no end date (until: null): only paused, never removed',
      from: holding({ inFlight: 'renew', lastUntil: null }),
      event: answer('renew', failed()),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'an end date still ahead: only a retry',
      from: holding({ inFlight: 'renew', lastUntil: TOMORROW }),
      event: answer('renew', failed()),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'no Lease ever accepted: no end date to pass',
      from: signedIn({ inFlight: 'renew', lastUntil: undefined }),
      event: answer('renew', failed()),
      next: { inFlight: null, retryStep: 1, reason: 'network' },
      effects: [armRenew(60_000), stateLog('unconfirmed', 'network'), PUBLISH],
    },
    {
      name: 'a clock set back before the end date does not un-end it',
      from: owing('ended', { inFlight: 'renew', lastUntil: TOMORROW }),
      event: answer('renew', failed(), { wall: Date.parse(YESTERDAY) }),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
    {
      name: 'the rule does not apply while another PC is known to hold the licence',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED, inFlight: 'activate', lastUntil: YESTERDAY }),
      event: answer('activate', failed()),
      next: { inFlight: null, retryStep: 1 },
      effects: [armRenew(60_000)],
    },
  ]);

  it('a moved answer wins over an end date that has passed', () => {
    const out = step(
      signedIn({ inFlight: 'renew', lastUntil: YESTERDAY }),
      answer('renew', leaseOutcome({ state: 'moved', holderName: 'PC-B' })),
    );
    expect(out.machine.state).toBe('moved');
    expect(out.machine.cleanup).toEqual({ owed: 'moved', folderGone: false });
    expect(out.effects).toContainEqual({ e: 'requestRemoval', reason: 'moved' });
    expect(out.effects).not.toContainEqual({ e: 'requestRemoval', reason: 'ended' });
  });

  it('once ended by date only a new Lease leaves it: later failures, status and triggers keep it ended', () => {
    const ended = step(holding({ inFlight: 'renew', lastUntil: YESTERDAY }), answer('renew', failed())).machine;
    const after = run(ended, [
      { t: 'status', active: true },
      { t: 'trigger', why: 'resume' },
      { t: 'windowEnded', mono: M + 10 * HOUR },
    ]);
    expect(after.machine.state).toBe('ended');
  });

  it('the Lease of a returning Premium leaves ended', () => {
    const out = step(gone('ended', { inFlight: 'renew' }), answer('renew', leaseOutcome()));
    expect(out.machine.state).toBe('holds');
  });
});

// -- 10. Triggers and single flight --------------------------------------------------------------------------

table('rule 11: the triggers', [
  {
    name: 'resume renews',
    from: holding(),
    event: { t: 'trigger', why: 'resume' },
    next: { inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'refresh renews',
    from: holding(),
    event: { t: 'trigger', why: 'refresh' },
    next: { inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'the timer renews',
    from: holding(),
    event: { t: 'trigger', why: 'timer' },
    next: { inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'a trigger during a request is absorbed (no follow-up for what the request already carries)',
    from: holding({ inFlight: 'renew' }),
    event: { t: 'trigger', why: 'refresh' },
    next: {},
    effects: [],
  },
  {
    name: 'a trigger with no one signed in does nothing',
    from: initialMachine(true),
    event: { t: 'trigger', why: 'resume' },
    next: {},
    effects: [],
  },
  {
    name: 'a trigger while inactive and never activated sends nothing',
    from: signedIn({ state: 'inactive', device: UNLINKED, premiumActive: false }),
    event: { t: 'trigger', why: 'resume' },
    next: {},
    effects: [],
  },
  {
    name: 'a trigger while another PC holds it asks to activate again (no Move)',
    from: signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED }),
    event: { t: 'trigger', why: 'resume' },
    next: { inFlight: 'activate' },
    effects: [ACTIVATE],
  },
  {
    name: 'a trigger while a removal report waits for the host sends nothing',
    from: owing('moved'),
    event: { t: 'trigger', why: 'timer' },
    next: {},
    effects: [],
  },
  {
    name: 'a pair change once linked renews at once',
    from: holding(),
    event: { t: 'pair', pair: OTHER_PAIR, allows: true },
    next: { pair: OTHER_PAIR, inFlight: 'renew' },
    effects: [RENEW],
  },
  {
    name: 'a pair change that closes the account gate sends nothing (the next renewal carries it)',
    from: holding({ pair: PAIR }),
    event: { t: 'pair', pair: OTHER_PAIR, allows: false },
    next: { pair: OTHER_PAIR },
    effects: [],
  },
  {
    name: 'a pair change with no device id sends nothing',
    from: signedIn({ device: UNLINKED }),
    event: { t: 'pair', pair: PAIR, allows: true },
    next: { pair: PAIR },
    effects: [],
  },
  {
    name: 'a pair change during a request waits one follow-up',
    from: holding({ inFlight: 'renew' }),
    event: { t: 'pair', pair: OTHER_PAIR, allows: true },
    next: { pair: OTHER_PAIR, followUp: true },
    effects: [],
  },
  {
    name: 'a pair change while a removal report is owed sends nothing (rule 3)',
    from: owing('moved'),
    event: { t: 'pair', pair: PAIR, allows: true },
    next: { pair: PAIR },
    effects: [],
  },
]);

describe('rule 10: one request in flight', () => {
  it('two triggers in the same second send one renewal', () => {
    const { effects } = run(holding(), [
      { t: 'trigger', why: 'resume' },
      { t: 'trigger', why: 'refresh' },
    ]);
    expect(effects.flat().filter((e) => e.e === 'renew')).toHaveLength(1);
  });

  it('a pair change during a renewal is followed by exactly one more renewal', () => {
    const { effects } = run(holding({ pair: PAIR }), [
      { t: 'trigger', why: 'timer' },
      { t: 'pair', pair: OTHER_PAIR, allows: true },
      { t: 'pair', pair: PAIR, allows: true },
      answer('renew', leaseOutcome()),
    ]);
    const requests = effects.flat().filter((e) => e.e === 'renew');
    expect(requests).toHaveLength(2);
    expect(effects[3]).toContainEqual(RENEW);
  });

  it('never has two requests in flight', () => {
    const { machine, effects } = run(holding(), [
      { t: 'trigger', why: 'timer' },
      { t: 'status', active: false },
      { t: 'pair', pair: PAIR, allows: true },
    ]);
    expect(effects.flat().filter((e) => e.e === 'renew')).toHaveLength(1);
    expect(machine.inFlight).toBe('renew');
    expect(machine.followUp).toBe(true);
  });

  it('renews at 0, 15 and 30 minutes by the timer it arms', () => {
    const { machine, effects } = run(signedIn({ device: DEVICE }), [
      { t: 'trigger', why: 'timer' },
      answer('renew', leaseOutcome()),
      { t: 'trigger', why: 'timer' },
      answer('renew', leaseOutcome(), { mono: M + RENEW_EVERY_MS }),
      { t: 'trigger', why: 'timer' },
    ]);
    expect(effects.flat().filter((e) => e.e === 'renew')).toHaveLength(3);
    expect(effects[1]).toContainEqual(armRenew(RENEW_EVERY_MS));
    expect(machine.inFlight).toBe('renew');
  });
});

// -- 11. Move ---------------------------------------------------------------------------------------------------

describe('rule 9: Move', () => {
  table('the press', [
    {
      name: 'in elsewhere: activate with move: true, the state unchanged, the button in flight',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED }),
      event: { t: 'movePressed' },
      next: { moveIntent: true, inFlight: 'move' },
      effects: [MOVE, PUBLISH],
    },
    {
      name: 'in released',
      from: gone('released', { device: UNLINKED }),
      event: { t: 'movePressed' },
      next: { moveIntent: true, inFlight: 'move' },
      effects: [MOVE, PUBLISH],
    },
    {
      name: 'in mismatch: forgets the key, makes a fresh one, and activates only after it is ready',
      from: signedIn({ state: 'mismatch' }),
      event: { t: 'movePressed' },
      next: { moveIntent: true, device: null, inFlight: 'ensure' },
      effects: [FORGET, ENSURE, PUBLISH],
    },
    {
      name: 'a press while a request is in flight is ignored',
      from: signedIn({ state: 'elsewhere', device: UNLINKED, inFlight: 'activate' }),
      event: { t: 'movePressed' },
      next: {},
      effects: [],
    },
    {
      name: 'a second press while the Move is in flight sends nothing',
      from: signedIn({ state: 'elsewhere', device: UNLINKED, moveIntent: true, inFlight: null }),
      event: { t: 'movePressed' },
      next: {},
      effects: [],
    },
    {
      name: 'a press while the removal report is owed is ignored',
      from: owing('released'),
      event: { t: 'movePressed' },
      next: {},
      effects: [],
    },
  ]);

  it.each(['signed_out', 'inactive', 'holds', 'unconfirmed', 'moved', 'ended', 'move_limit'] as const)(
    'a press in %s is never a Move',
    (state) => {
      const from = signedIn({ state, device: UNLINKED });
      const out = step(from, { t: 'movePressed' });
      expect(out.machine).toEqual(from);
      expect(out.effects).toEqual([]);
    },
  );

  it('a mismatch Move activates with move: true once the fresh key is ready', () => {
    const { machine, effects } = run(signedIn({ state: 'mismatch' }), [
      { t: 'movePressed' },
      { t: 'deviceReady', device: { keyId: 'fresh-key', deviceId: null, hasSalt: true } },
    ]);
    expect(effects[1]).toEqual([MOVE]);
    expect(machine.inFlight).toBe('move');
  });

  table('the answer', [
    {
      name: 'a verified Lease: holds, the Move settled, the device id stored',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED, moveIntent: true, inFlight: 'move' }),
      event: answer('move', leaseOutcome({}, 'device-9')),
      next: {
        device: { ...UNLINKED, deviceId: 'device-9' },
        inFlight: null,
        moveIntent: false,
        state: 'holds',
        holderName: undefined,
        lease: { payload: payload(), windowEndsMono: M + HOUR },
        lastUntil: null,
      },
      effects: [
        { e: 'saveDeviceId', deviceId: 'device-9' },
        SEAL_LEASE,
        armWindow(HOUR),
        armRenew(RENEW_EVERY_MS),
        stateLog('holds'),
        PUBLISH,
      ],
    },
    {
      name: 'move_limit: both dates, the button disabled by the state',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED, moveIntent: true, inFlight: 'move' }),
      event: answer('move', { kind: 'moveLimit', lastMoveAt: YESTERDAY, nextMoveAt: TOMORROW }),
      next: {
        inFlight: null,
        moveIntent: false,
        state: 'move_limit',
        holderName: undefined,
        lastMoveAt: YESTERDAY,
        nextMoveAt: TOMORROW,
      },
      effects: [DISARM_WINDOW, stateLog('move_limit'), PUBLISH],
    },
    {
      name: 'a failure returns to the state before the press with the failure line and no retry',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED, moveIntent: true, inFlight: 'move' }),
      event: answer('move', failed()),
      next: { inFlight: null, moveIntent: false, moveFailed: true },
      effects: [PUBLISH],
    },
    {
      name: 'an invalid Lease is a failed Move',
      from: signedIn({ state: 'released', device: UNLINKED, moveIntent: true, inFlight: 'move', removalDone: true }),
      event: answer('move', { kind: 'leaseInvalid', check: 'user' }),
      next: { inFlight: null, moveIntent: false, moveFailed: true },
      effects: [rejectedLog('user'), PUBLISH],
    },
    {
      name: 'a clock-skew refusal is a failed Move, not an unconfirmed state',
      from: signedIn({ state: 'mismatch', moveIntent: true, inFlight: 'move' }),
      event: answer('move', { kind: 'deviceSignature' }),
      next: { inFlight: null, moveIntent: false, moveFailed: true },
      effects: [PUBLISH],
    },
    {
      name: 'a bearer 401 signs out and leaves the press for the sign-out to clear',
      from: signedIn({ state: 'elsewhere', device: UNLINKED, moveIntent: true, inFlight: 'move' }),
      event: answer('move', { kind: 'unauthorized' }),
      next: { inFlight: null },
      effects: [{ e: 'signOut' }],
    },
    {
      name: 'device_foreign during a Move forgets the key and keeps the press: it continues as a Move with a new key',
      from: signedIn({ state: 'elsewhere', holderName: 'PC-B', moveIntent: true, inFlight: 'move' }),
      event: answer('move', { kind: 'foreign' }),
      next: { inFlight: 'ensure', device: null, foreignRetried: true },
      effects: [DISARM_WINDOW, FORGET, ENSURE],
    },
  ]);

  it('a Move continues as a Move after device_foreign', () => {
    const { machine, effects } = run(
      signedIn({ state: 'elsewhere', holderName: 'PC-B', moveIntent: true, inFlight: 'move' }),
      [answer('move', { kind: 'foreign' }), { t: 'deviceReady', device: { keyId: 'new', deviceId: null, hasSalt: true } }],
    );
    expect(effects[1]).toEqual([MOVE]);
    expect(machine.moveIntent).toBe(true);
  });

  it('a failed Move can be pressed again', () => {
    const { effects } = run(signedIn({ state: 'elsewhere', holderName: 'PC-B', device: UNLINKED }), [
      { t: 'movePressed' },
      answer('move', failed()),
      { t: 'movePressed' },
    ]);
    expect(effects[2]).toEqual([MOVE, PUBLISH]);
  });

  it('never sends a Move without a press', () => {
    const triggers: Event[] = [
      { t: 'trigger', why: 'resume' },
      { t: 'trigger', why: 'refresh' },
      { t: 'trigger', why: 'timer' },
      { t: 'status', active: true },
      { t: 'pair', pair: PAIR, allows: true },
    ];
    for (const state of ['elsewhere', 'mismatch', 'released', 'unconfirmed'] as const) {
      const { effects } = run(signedIn({ state, device: UNLINKED }), triggers);
      expect(effects.flat()).not.toContainEqual(MOVE);
    }
  });
});

// -- 12. The removal hand-off ---------------------------------------------------------------------------------

describe('rule 3: removal first', () => {
  table('folderGone', [
    {
      name: 'the host says gone: the report is sent at once',
      from: owing('moved'),
      event: { t: 'folderGone' },
      next: { cleanup: { owed: 'moved', folderGone: true }, removalDone: true, inFlight: 'cleanup' },
      effects: [CLEANUP, PUBLISH],
    },
    {
      name: 'gone with nothing owed is ignored',
      from: gone('moved'),
      event: { t: 'folderGone' },
      next: {},
      effects: [],
    },
    {
      name: 'a report with no key to sign it is dropped rather than looped on',
      from: owing('moved', { device: null }),
      event: { t: 'folderGone' },
      next: { cleanup: { owed: null, folderGone: false }, removalDone: true, inFlight: 'ensure' },
      effects: [CLEAR_OWED, ENSURE, PUBLISH],
    },
  ]);

  it('sends no report before the host answers gone, whatever else happens', () => {
    const triggers: Event[] = [
      { t: 'trigger', why: 'resume' },
      { t: 'trigger', why: 'timer' },
      { t: 'status', active: true },
      { t: 'pair', pair: PAIR, allows: true },
      { t: 'movePressed' },
    ];
    const { effects } = run(owing('ended'), triggers);
    expect(effects.flat().map((e) => e.e)).not.toContain('cleanup');
    expect(effects.flat().map((e) => e.e)).not.toContain('renew');
  });

  it('resends a report that was answered 503, and again after a restart', () => {
    const sent = run(owing('moved'), [
      { t: 'folderGone' },
      answer('cleanup', failed()),
      { t: 'trigger', why: 'timer' },
    ]);
    expect(sent.effects[0]).toContainEqual(CLEANUP);
    expect(sent.effects[1]).toEqual([armRenew(60_000)]);
    expect(sent.effects[2]).toEqual([CLEANUP]);

    const restarted = run(initialMachine(true), [
      { t: 'started', enabled: true, ...begin({ cleanupOwed: 'moved', sealedLease: payload({ state: 'moved' }) }) },
      { t: 'folderGone' },
    ]);
    expect(restarted.effects[0]).toContainEqual({ e: 'requestRemoval', reason: 'moved' });
    expect(restarted.effects[0]?.map((e) => e.e)).not.toContain('renew');
    expect(restarted.effects[1]).toContainEqual(CLEANUP);
  });

  it('keeps the marker over sign-out and reports at the next sign-in', () => {
    const out = run(owing('released'), [
      { t: 'signedOut' },
      { t: 'signedIn', ...begin({ cleanupOwed: 'released' }) },
      { t: 'folderGone' },
    ]);
    expect(out.effects.flat().map((e) => e.e)).not.toContain('clearCleanupOwed');
    expect(out.effects[1]).toContainEqual({ e: 'requestRemoval', reason: 'released' });
    expect(out.effects[2]).toContainEqual(CLEANUP);
  });

  it('answers a removal state once the report is confirmed and goes back to renewing', () => {
    const { machine, effects } = run(owing('moved'), [
      { t: 'folderGone' },
      answer('cleanup', { kind: 'cleanup', result: 'confirmed' }),
    ]);
    expect(effects[1]).toEqual([CLEAR_OWED, RENEW]);
    expect(machine.cleanup).toEqual({ owed: null, folderGone: false });
    expect(machine.removalDone).toBe(true);
  });
});

describe('paused never asks for removal', () => {
  const scenarios: ReadonlyArray<readonly [string, Machine, Event]> = [
    ['a holder whose window ends', holding(), { t: 'windowEnded', mono: M + HOUR }],
    ['a failed renewal with no end date', holding({ inFlight: 'renew' }), answer('renew', failed())],
    ['a failed renewal before the end date', holding({ inFlight: 'renew', lastUntil: TOMORROW }), answer('renew', failed())],
    ['a bad signature header', holding({ inFlight: 'renew' }), answer('renew', { kind: 'deviceSignature' })],
    ['an invalid Lease', holding({ inFlight: 'renew' }), answer('renew', { kind: 'leaseInvalid', check: 'signature' })],
    ['no secure storage', signedIn({ inFlight: 'ensure', device: null }), { t: 'identityFailed', reason: 'no_secure_storage' }],
    ['a restart with no end date', initialMachine(true), { t: 'started', enabled: true, ...begin({ sealedLease: payload() }) }],
    ['a paused Lease (other account)', holding({ inFlight: 'renew' }), answer('renew', leaseOutcome({ state: 'paused_other_account' }))],
  ];

  it.each(scenarios.map((s) => [s[0], s[1], s[2]] as const))('%s', (_name, from, event) => {
    const out = step(from, event);
    const kinds = out.effects.map((e) => e.e);
    expect(kinds).not.toContain('requestRemoval');
    expect(kinds).not.toContain('markCleanupOwed');
  });
});

// -- 13. Remaining spec edge cases ----------------------------------------------------------------------------

describe('spec edge cases', () => {
  it('a Windows reinstall (new MachineGuid) answers device_mismatch and the way out is a Move with a fresh key', () => {
    const { machine, effects } = run(holding({ inFlight: 'renew' }), [
      answer('renew', { kind: 'mismatch' }),
      { t: 'movePressed' },
      { t: 'deviceReady', device: { keyId: 'fresh', deviceId: null, hasSalt: true } },
    ]);
    expect(effects[1]).toEqual([FORGET, ENSURE, PUBLISH]);
    expect(effects[2]).toEqual([MOVE]);
    expect(machine.moveIntent).toBe(true);
  });

  it('copied app data answers device_mismatch too, and the copy holds no Lease', () => {
    const out = step(signedIn({ inFlight: 'renew' }), answer('renew', { kind: 'mismatch' }));
    expect(out.machine.state).toBe('mismatch');
    expect(out.machine.lease).toBeNull();
  });

  it('moved while offline: stays unconfirmed (paused) until it reaches the API, then moves and removes', () => {
    const { machine, effects } = run(holding(), [
      { t: 'trigger', why: 'timer' },
      answer('renew', failed()),
      { t: 'windowEnded', mono: M + HOUR },
      { t: 'trigger', why: 'timer' },
      answer('renew', leaseOutcome({ state: 'moved', holderName: 'PC-B' }), { mono: M + HOUR + 1000 }),
    ]);
    expect(effects[2]).toEqual([stateLog('unconfirmed', 'network'), PUBLISH]);
    expect(effects[4]).toContainEqual({ e: 'requestRemoval', reason: 'moved' });
    expect(machine.state).toBe('moved');
    expect(machine.holderName).toBe('PC-B');
  });

  it('Premium returning while this PC was the last holder: the next renewal answers active with no Move', () => {
    const { machine, effects } = run(gone('ended', { premiumActive: false }), [
      { t: 'status', active: true },
      answer('renew', leaseOutcome()),
    ]);
    expect(effects[0]).toEqual([RENEW]);
    expect(machine.state).toBe('holds');
    expect(machine.moveIntent).toBe(false);
    expect(effects.flat()).not.toContainEqual(MOVE);
  });

  it('another game account playing: the gate closes at once, the next renewal carries the new pair and comes back paused', () => {
    const holder = holding({ pair: PAIR });
    expect(leaseGateOpen(holder, M, true)).toBe(true);
    const switched = step(holder, { t: 'pair', pair: OTHER_PAIR, allows: false });
    expect(leaseGateOpen(switched.machine, M, false)).toBe(false);
    expect(switched.effects).toEqual([]);
    const back = step(
      { ...switched.machine, inFlight: 'renew' },
      answer('renew', leaseOutcome({ state: 'paused_other_account', playing: OTHER_PAIR })),
    );
    expect(back.machine.state).toBe('holds');
    expect(leaseGateOpen(back.machine, M, false)).toBe(false);
  });

  it('status inactive never activates and never ends a holder', () => {
    const { machine, effects } = run(holding(), [{ t: 'status', active: false }]);
    expect(machine.state).toBe('holds');
    expect(effects.flat().map((e) => e.e)).not.toContain('activate');
    expect(effects.flat().map((e) => e.e)).not.toContain('requestRemoval');
  });
});

// -- 14. The gate and the view ----------------------------------------------------------------------------------

describe('leaseGateOpen', () => {
  const open = holding({ pair: PAIR });

  it('is true for a verified active Lease in its window with a matching pair and an open account gate', () => {
    expect(leaseGateOpen(open, M, true)).toBe(true);
  });

  it('is false the moment the window ends', () => {
    expect(leaseGateOpen(open, M + HOUR - 1, true)).toBe(true);
    expect(leaseGateOpen(open, M + HOUR, true)).toBe(false);
  });

  it.each<readonly [string, Machine, boolean]>([
    ['the account gate is closed', open, false],
    ['no Lease', { ...open, lease: null }, true],
    ['a paused Lease', { ...open, lease: { payload: payload({ state: 'paused_other_account' }), windowEndsMono: M + HOUR } }, true],
    ['a Lease for another device key', { ...open, lease: { payload: payload({ deviceKeyId: 'other' }), windowEndsMono: M + HOUR } }, true],
    ['a Lease pair that is not the session pair', { ...open, pair: OTHER_PAIR }, true],
    ['no session pair', { ...open, pair: null }, true],
    ['no device', { ...open, device: null }, true],
    ['no one signed in', { ...open, subject: null }, true],
    ['a disabled flavour', { ...open, enabled: false }, true],
  ])('is false with %s', (_name, machine, allows) => {
    expect(leaseGateOpen(machine, M, allows)).toBe(false);
  });

  it('is true for a Lease with no playing pair when the session reads none', () => {
    const none = { ...open, pair: null, lease: { payload: payload({ playing: null }), windowEndsMono: M + HOUR } };
    expect(leaseGateOpen(none, M, true)).toBe(true);
  });

  it('is false after a restart until the first answer of the run', () => {
    const { machine } = run(initialMachine(true), [
      { t: 'started', enabled: true, ...begin({ sealedLease: payload({ until: TOMORROW }) }) },
    ]);
    expect(leaseGateOpen(machine, M, true)).toBe(false);
  });
});

describe('licenceView', () => {
  it('carries only the approved fields', () => {
    const view = licenceView(
      signedIn({
        state: 'move_limit',
        lastMoveAt: YESTERDAY,
        nextMoveAt: TOMORROW,
        holderName: 'PC-B',
        device: DEVICE,
        pair: PAIR,
        lease: { payload: payload(), windowEndsMono: 1 },
      }),
    );
    expect(Object.keys(view).sort()).toEqual(
      ['holderName', 'lastMoveAt', 'moveFailed', 'moveInFlight', 'nextMoveAt', 'removalDone', 'state'].sort(),
    );
    expect(JSON.stringify(view)).not.toContain('device-key');
    expect(JSON.stringify(view)).not.toContain('76561198');
  });

  it('shows the reason only when there is one', () => {
    expect(licenceView(signedIn({ reason: 'network' })).reason).toBe('network');
    expect('reason' in licenceView(signedIn())).toBe(false);
  });

  it('reports a pressed Move as in flight', () => {
    expect(licenceView(signedIn({ moveIntent: true })).moveInFlight).toBe(true);
  });
});

describe('effects and logs', () => {
  it('logs only the state and reason, and the check name for a rejected Lease', () => {
    const out = step(holding({ inFlight: 'renew' }), answer('renew', { kind: 'leaseInvalid', check: 'device' }));
    for (const effect of out.effects) {
      if (effect.e !== 'log') continue;
      expect(Object.keys(effect.fields).sort()).toEqual(['check']);
    }
    const state = step(signedIn({ inFlight: 'renew' }), answer('renew', failed()));
    const stateLogged = state.effects.find((e) => e.e === 'log');
    expect(stateLogged).toEqual(stateLog('unconfirmed', 'network'));
  });

  it('does not publish or log when nothing visible changed', () => {
    const out = step(holding(), { t: 'trigger', why: 'timer' });
    expect(out.effects.map((e) => e.e)).toEqual(['renew']);
  });

  it('never carries a key, an id or Lease bytes in a log record', () => {
    const outcomes: Outcome[] = [
      leaseOutcome({ state: 'moved', holderName: 'PC-B' }),
      leaseOutcome(),
      { kind: 'leaseInvalid', check: 'signature' },
      failed(),
      { kind: 'mismatch' },
    ];
    for (const outcome of outcomes) {
      const out = step(holding({ inFlight: 'renew' }), answer('renew', outcome));
      const text = JSON.stringify(out.effects.filter((e) => e.e === 'log'));
      expect(text).not.toContain('device-key');
      expect(text).not.toContain('76561198');
      expect(text).not.toContain(SEAL.leaseB64);
    }
  });
});
