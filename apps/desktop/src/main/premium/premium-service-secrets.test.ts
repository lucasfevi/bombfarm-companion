import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { SECRETS, createFakeVault, createHarness, session, settle, unreachable, type Harness } from './premium-test-support.js';
import { fingerprint } from './licence/fingerprint.js';
import { createHostRig, ECHO_CAPABILITY, flush, SUBJECT, workerOptions, type HostRig } from './host/host-service-test-support.js';
import {
  DEVICE_ID,
  MACHINE_GUID,
  MINUTE,
  SALT,
  USER,
  createLicenceHarness,
  keyIdOf,
  present,
  signedLease,
  type LicenceHarness,
} from './licence/licence-test-support.js';

const NEVER_LOGGED_OR_EMITTED = [
  SECRETS.token,
  SECRETS.rotatedToken,
  SECRETS.verifier,
  SECRETS.state,
  SECRETS.code,
  SECRETS.approvalUrl,
  SECRETS.handOffUrl,
];

const LITERAL_EVENTS = [
  'signin.started',
  'signin.ended',
  'status.refresh_failed',
  'status.unreadable',
  'report.outcome',
  'handoff.failed',
  'signout.unreachable',
  'account_state',
];

const NEVER_LOGGED = [...NEVER_LOGGED_OR_EMITTED, SECRETS.accountId, SECRETS.steamId64];

function everyLogRecord(h: Harness): string {
  return JSON.stringify(h.log.records);
}

const NEVER_EMITTED = [...NEVER_LOGGED_OR_EMITTED, SECRETS.steamId64];

/** The game account id is shown to the player, so a view may carry it under `reportedAccountId` and nowhere else. */
function everyEmittedView(h: Harness): string {
  return JSON.stringify([...h.views, h.service.getView()], (key, value: unknown) =>
    key === 'reportedAccountId' ? null : value,
  );
}

function expectClean(h: Harness): void {
  expect(h.log.records.length).toBeGreaterThan(0);
  expect(h.views.length).toBeGreaterThan(0);
  for (const secret of NEVER_LOGGED) expect(everyLogRecord(h), `log record holds ${secret}`).not.toContain(secret);
  const emitted = everyEmittedView(h);
  for (const secret of [...NEVER_EMITTED, SECRETS.accountId]) {
    expect(emitted, `emitted view holds ${secret}`).not.toContain(secret);
  }
}

describe('secrets stay out of logs and views', () => {
  it('through a completed sign-in', async () => {
    const h = createHarness();
    h.service.start();

    await h.signedIn();

    expect(h.opened).toEqual([SECRETS.approvalUrl]);
    expect(h.vault.stores).toHaveLength(1);
    expectClean(h);
  });

  it.each([
    [
      'a cancel',
      (h: Harness) => {
        h.service.cancelSignIn();
      },
    ],
    [
      'a decline',
      (h: Harness) => {
        h.listeners.made[0]?.finish({ kind: 'declined' });
      },
    ],
    [
      'a timeout',
      (h: Harness) => {
        h.listeners.made[0]?.finish({ kind: 'timed-out' });
      },
    ],
    [
      'a refused exchange',
      (h: Harness) => {
        h.stub.on('token', { status: 400 });
        h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
      },
    ],
    [
      'an unreachable exchange',
      (h: Harness) => {
        h.stub.on('token', unreachable);
        h.listeners.made[0]?.finish({ kind: 'code', code: SECRETS.code });
      },
    ],
  ])('through %s', async (_name, finish) => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();

    finish(h);
    await settle();

    expect(h.service.getView().session).toBe('signed-out');
    expectClean(h);
  });

  it('through a bad URL, a failed bind and a browser that will not open', async () => {
    const badUrl = createHarness();
    badUrl.service.start();
    badUrl.stub.on('signInRequest', { status: 201, body: { approvalUrl: 'http://approve.invalid/x', expiresAt: 'x' } });
    await badUrl.service.signIn();
    expectClean(badUrl);

    const noPort = createHarness();
    noPort.service.start();
    noPort.listeners.failNext();
    await noPort.service.signIn();
    expectClean(noPort);

    const noBrowser = createHarness();
    noBrowser.service.start();
    noBrowser.failOpening();
    await noBrowser.service.signIn();
    expectClean(noBrowser);
  });

  it('through refreshes that succeed, fail, are limited or are unreadable', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    await settle();
    for (const reply of [{ status: 503 }, { status: 429 }, { status: 200, body: { nonsense: true } }, { status: 401 }]) {
      h.stub.on('status', reply);
      await h.clock.advance(3_600_000);
    }

    expect(h.log.events()).toEqual(
      expect.arrayContaining(['status.refresh_failed', 'status.unreadable']),
    );
    expectClean(h);
  });

  it('through a rotation, for both the old and the new token', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token, 0)) });
    h.stub.on('status', { status: 503 });
    h.service.start();
    await settle();

    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.vault.held()?.token).toBe(SECRETS.rotatedToken);
    expectClean(h);
  });

  it('through a rotation that is refused and one that signs the player out', async () => {
    for (const reply of [{ status: 409 }, { status: 401 }]) {
      const h = createHarness({ vault: createFakeVault(session(SECRETS.token, 0)) });
      h.stub.on('rotate', reply);
      h.stub.on('status', { status: 503 });
      h.service.start();
      await settle();
      await h.clock.advance(3_600_000);
      h.log.records.push({ scope: 'premium', event: 'checked' });
      expectClean(h);
    }
  });

  it('through a sign-out, including one the API never answers', async () => {
    const h = createHarness({
      vault: createFakeVault(session(SECRETS.token)),
      api: (real) => ({ ...real, signOut: () => Promise.reject(new Error(SECRETS.token)) }),
    });
    h.service.start();
    await settle();

    await h.service.signOut();

    expect(h.log.events()).toContain('signout.unreachable');
    expectClean(h);
  });

  it.each([
    ['linked', { status: 200, body: { outcome: 'linked' } }],
    ['refused', { status: 409, body: { reason: 'steam_mismatch' } }],
    ['failed', { status: 500 }],
  ])('through a report that ends %s, with the account id and SteamID', async (_name, reply) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', reply);
    h.service.start();
    await settle();

    expect(h.log.events()).toContain('report.outcome');
    expect(h.service.getView().reportedAccountId).toBe(SECRETS.accountId);
    expectClean(h);
  });

  it('through a report that cannot be sent and one the API turns away', async () => {
    const unreadable = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    unreadable.identity.current = { accountId: SECRETS.accountId, steamId64: null, playerName: null };
    unreadable.stub.on('status', { status: 503 });
    unreadable.service.start();
    await settle();
    expectClean(unreadable);

    const turnedAway = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    turnedAway.stub.on('report', { status: 401 });
    turnedAway.stub.on('status', { status: 503 });
    turnedAway.service.start();
    await settle();
    expect(turnedAway.service.getView()).toMatchObject({ session: 'signed-out', ended: 'expired' });
    await turnedAway.service.signIn();
    turnedAway.service.cancelSignIn();
    expectClean(turnedAway);
  });

  it('shows the account id on the view under reportedAccountId and under no other key', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    await settle();

    const view = h.service.getView();
    expect(view.reportedAccountId).toBe(SECRETS.accountId);
    expect(JSON.stringify({ ...view, reportedAccountId: null })).not.toContain(SECRETS.accountId);
  });

  it('through Manage Premium, opened or refused, for the hand-off URL', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    await settle();

    await h.service.manage();
    h.stub.on('handOff', { status: 200, body: { url: 'http://manage.invalid/enter/handoff-fixture-84fd19', expiresAt: 'x' } });
    await h.service.manage();
    h.stub.on('handOff', { status: 401 });
    await h.service.manage();

    expect(h.opened).toEqual([SECRETS.handOffUrl]);
    expect(h.log.events()).toContain('handoff.failed');
    expectClean(h);
  });

  it('logs only literal events under the premium scope', async () => {
    const h = createHarness();
    h.service.start();
    await h.signedIn();

    for (const record of h.log.records) {
      expect(record['scope']).toBe('premium');
      expect(LITERAL_EVENTS).toContain(record['event']);
      for (const value of Object.values(record)) expect(['string', 'number']).toContain(typeof value);
    }
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'signin.started' });
    expect(h.log.records).toContainEqual({ scope: 'premium', event: 'signin.ended', reason: 'completed' });
  });

  it('logs the reason an attempt ended and nothing else', async () => {
    const h = createHarness();
    h.service.start();
    await h.service.signIn();

    h.service.cancelSignIn();

    expect(h.log.records.at(-1)).toEqual({ scope: 'premium', event: 'signin.ended', reason: 'cancelled' });
  });

  it('never carries a key named for a secret on the view', async () => {
    const h = createHarness();
    await h.signedIn();
    const forbidden = ['token', 'code', 'verifier', 'state', 'url'];

    for (const view of h.views) {
      for (const key of Object.keys(view)) expect(forbidden).not.toContain(key);
    }
  });
});

describe('the playing-account state carries no id', () => {
  const OTHER = { accountId: 'account-fixture-7781', steamId64: '76561198055555555', playerName: null };
  const UNLINKED = { accountId: 'account-fixture-6602', steamId64: '76561198066666666', playerName: null };

  it('through switches between accounts, a refusal of each kind, a failure and a sign-out', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    const notified: unknown[] = [];
    h.playing.subscribe((next) => notified.push(next));
    h.stub.on('report', (request) => {
      const steamId = (request.body as { steam_id64: string }).steam_id64;
      if (steamId === OTHER.steamId64) return { status: 409, body: { reason: 'steam_mismatch' } };
      if (steamId === UNLINKED.steamId64) return { status: 409, body: { reason: 'no_steam_id' } };
      return { status: 200, body: { outcome: 'linked' } };
    });
    h.service.start();
    await settle();

    for (const next of [OTHER, UNLINKED, null, { ...OTHER, steamId64: 'not-a-steam-id' }]) {
      h.identity.current = next;
      h.service.noteAccountChanged();
      await settle();
    }
    h.stub.on('report', unreachable);
    h.identity.current = { ...OTHER, accountId: 'account-fixture-1199' };
    h.service.noteAccountChanged();
    await settle();
    h.identity.current = { accountId: SECRETS.accountId, steamId64: SECRETS.steamId64, playerName: null };
    h.service.noteAccountChanged();
    await settle();
    await h.service.signOut();

    const reasons = new Set(h.views.map((view) => view.playingAccount.reason));
    for (const reason of ['checking', 'other_account', 'no_steam_link', 'no_session', 'no_steam_id64', 'report_failed', 'signed_out']) {
      expect(reasons, `a view with ${reason}`).toContain(reason);
    }
    expectClean(h);

    const steamIds = [SECRETS.steamId64, OTHER.steamId64, UNLINKED.steamId64];
    const accountIds = [SECRETS.accountId, OTHER.accountId, UNLINKED.accountId, 'account-fixture-1199'];
    const states = JSON.stringify([notified, h.views.map((view) => view.playingAccount)]);
    const logs = JSON.stringify(h.log.records);
    const views = everyEmittedView(h);
    for (const id of [...steamIds, ...accountIds]) {
      expect(states, `playing-account state holds ${id}`).not.toContain(id);
      expect(logs, `log record holds ${id}`).not.toContain(id);
    }
    for (const id of steamIds) expect(views, `emitted view holds ${id}`).not.toContain(id);
    for (const value of [...notified, ...h.views.map((view) => view.playingAccount)]) {
      expect(Object.keys(value as object).sort()).toEqual(['reason', 'state']);
    }
  });
});

describe('the licence keeps its secrets out of logs and IPC', () => {
  const VIEW_KEYS = ['state', 'reason', 'holderName', 'lastMoveAt', 'nextMoveAt', 'moveInFlight', 'moveFailed', 'removalDone'];
  type Reply = { status: number; body: unknown };
  const HELD_ELSEWHERE: Reply = { status: 409, body: { reason: 'held_elsewhere', holderName: 'OTHER-PC', nextMoveAt: null } };
  const MOVE_LIMIT: Reply = {
    status: 409,
    body: { reason: 'move_limit', lastMoveAt: '2026-10-20T00:00:00.000Z', nextMoveAt: '2026-11-19T00:00:00.000Z' },
  };

  interface Sweep {
    h: LicenceHarness;
    /** Every Lease envelope the stub handed out, sealed or not. */
    issued: Array<{ lease: string; sig: string }>;
  }

  function sweepHarness(): Sweep {
    const h = createLicenceHarness();
    const issued: Sweep['issued'] = [];
    const lease = h.lease.bind(h);
    h.lease = (request, spec) => {
      const reply = lease(request, spec);
      issued.push(reply.body as { lease: string; sig: string });
      return reply;
    };
    return { h, issued };
  }

  /** Marker values for every secret the licence handles, read from what the run actually produced. */
  function markers({ h, issued }: Sweep): Array<[string, string]> {
    const named: Array<[string, string]> = [
      ['subject', USER],
      ['machine guid', MACHINE_GUID],
      ['salt', SALT],
      ['salt bytes (hex)', Buffer.from(SALT, 'base64url').toString('hex')],
      ['salt bytes (base64)', Buffer.from(SALT, 'base64url').toString('base64')],
      ['fingerprint', fingerprint(SALT, MACHINE_GUID)],
      ['device id', DEVICE_ID],
      ['steam id', SECRETS.steamId64],
      ['account id', SECRETS.accountId],
    ];
    for (const record of h.store.deviceWrites) {
      const der = record.privateKey.export({ type: 'pkcs8', format: 'der' });
      named.push(
        ['private key (base64url)', der.toString('base64url')],
        ['private key (base64)', der.toString('base64')],
        ['public key', record.publicKey],
        ['device key id', record.keyId],
      );
      if (record.fingerprintSalt !== null) named.push(['sealed salt', record.fingerprintSalt]);
      if (record.deviceId !== null) named.push(['sealed device id', record.deviceId]);
    }
    for (const envelope of [...issued, ...h.store.leaseWrites.map((r) => ({ lease: r.leaseB64, sig: r.sig }))]) {
      named.push(['lease bytes', envelope.lease], ['lease signature', envelope.sig]);
    }
    return named;
  }

  function expectLicenceClean(sweep: Sweep, options: { leases?: boolean } = {}): void {
    const { h } = sweep;
    const all = markers(sweep);
    expect(
      all.some(([name]) => name === 'private key (base64url)'),
      'a device key was generated',
    ).toBe(true);
    if (options.leases !== false) expect(all.some(([name]) => name === 'lease bytes')).toBe(true);

    const logs = JSON.stringify(h.premium.log.records);
    // The Premium view shows the game account id to the player under `reportedAccountId`; nothing else may carry it.
    const emitted = JSON.stringify([...h.views, h.licence.view(), ...h.premium.views], (key, value: unknown) =>
      key === 'reportedAccountId' ? null : value,
    );
    const secrets: Array<[string, string]> = [...all, ['session token', SECRETS.token]];
    for (const [name, value] of secrets) {
      expect(logs, `a log record holds the ${name}`).not.toContain(value);
      expect(emitted, `an emitted view holds the ${name}`).not.toContain(value);
    }

    for (const view of [...h.views, h.licence.view()]) {
      for (const key of Object.keys(view)) expect(VIEW_KEYS, `view key ${key}`).toContain(key);
    }
    for (const record of h.premium.log.records) {
      if (typeof record['event'] !== 'string' || !record['event'].startsWith('premium.')) continue;
      const keys = Object.keys(record).sort();
      if (record['event'] === 'premium.licence_state') {
        expect(keys).toEqual(record['reason'] === undefined ? ['event', 'scope', 'state'] : ['event', 'reason', 'scope', 'state']);
      } else {
        expect(record['event']).toBe('premium.lease_rejected');
        expect(keys).toEqual(['check', 'event', 'scope']);
      }
    }
  }

  async function holder(): Promise<Sweep> {
    const sweep = sweepHarness();
    sweep.h.scriptHolder();
    await sweep.h.boot();
    await sweep.h.premium.clock.advance(0);
    return sweep;
  }

  it('through an activation and the renewals that follow', async () => {
    const sweep = await holder();
    await sweep.h.premium.clock.advance(31 * MINUTE);

    expect(sweep.h.licence.view().state).toBe('holds');
    expectLicenceClean(sweep);
  });

  it.each<[string, Reply]>([
    ['held elsewhere', HELD_ELSEWHERE],
    ['the move limit', MOVE_LIMIT],
    ['a device mismatch', { status: 409, body: { reason: 'device_mismatch' } }],
    ['Premium inactive', { status: 403, body: { reason: 'premium_inactive' } }],
    ['a foreign device', { status: 403, body: { reason: 'device_foreign' } }],
    ['a device signature refusal', { status: 401, body: { reason: 'device_signature' } }],
    ['a bearer refusal', { status: 401, body: '' }],
    ['a busy server', { status: 503, body: { reason: 'busy' } }],
    ['an unreadable answer', { status: 200, body: { nothing: true } }],
  ])('through an activation answered with %s', async (_name, reply) => {
    const sweep = sweepHarness();
    sweep.h.scriptHolder();
    // A refused fresh key is only answered once: the machine starts again at once after it, so a server
    // that kept saying "foreign" would be asked without pause.
    let asked = 0;
    sweep.h.premium.stub.on('licenceActivate', (request) =>
      (reply.body as { reason?: string }).reason === 'device_foreign' && (asked += 1) > 1 ? sweep.h.activation(request) : reply,
    );

    await sweep.h.boot();
    await sweep.h.premium.clock.advance(6 * MINUTE);
    await sweep.h.restart();

    expectLicenceClean(sweep, { leases: false });
  });

  it('through a salt the server refuses to give', async () => {
    const sweep = sweepHarness();
    sweep.h.scriptHolder();
    sweep.h.premium.stub.on('licence', { status: 503, body: { reason: 'busy' } });

    await sweep.h.boot();

    expectLicenceClean(sweep, { leases: false });
  });

  it.each<[string, Reply | null, boolean]>([
    ['pressed twice and answered', null, true],
    ['answered with the move limit', MOVE_LIMIT, false],
    ['answered with a busy server', { status: 503, body: { reason: 'busy' } }, false],
  ])('through a Move %s', async (_name, moveReply, leases) => {
    const sweep = sweepHarness();
    const { h } = sweep;
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', (request) =>
      (request.body as { move: boolean }).move ? (moveReply ?? h.activation(request)) : HELD_ELSEWHERE,
    );
    await h.boot();

    h.licence.pressMove();
    h.licence.pressMove();
    await h.premium.clock.advance(0);
    await h.restart();

    expectLicenceClean(sweep, { leases });
  });

  it.each<[string, Reply | 'moved' | 'released' | 'ended']>([
    ['a Lease that says moved', 'moved'],
    ['a Lease that says released', 'released'],
    ['a Lease that says ended', 'ended'],
    ['a device mismatch', { status: 409, body: { reason: 'device_mismatch' } }],
    ['a foreign device', { status: 403, body: { reason: 'device_foreign' } }],
    ['a device signature refusal', { status: 401, body: { reason: 'device_signature' } }],
    ['a bearer refusal', { status: 401, body: '' }],
    ['a rate limit', { status: 429, body: '' }],
    ['a busy server', { status: 503, body: { reason: 'busy' } }],
    ['an unreadable answer', { status: 200, body: { nothing: true } }],
  ])('through a renewal answered with %s', async (_name, answer) => {
    const sweep = await holder();
    const { h } = sweep;
    h.premium.stub.on(
      'lease',
      typeof answer === 'string' ? (request) => h.lease(request, { state: answer, holderName: 'NEW-PC' }) : answer,
    );

    h.licence.trigger('refresh');
    await settle();
    await h.premium.clock.advance(16 * MINUTE);
    await h.restart();

    expectLicenceClean(sweep);
  });

  it('through Leases that fail a check, one check at a time', async () => {
    const sweep = await holder();
    const { h } = sweep;
    const at = () => h.premium.clock.now();
    const bad = [
      (deviceKeyId: string) => signedLease({ deviceKeyId, issuedAtMs: at(), user: 'someone-else-marker-9' }),
      () => signedLease({ deviceKeyId: 'other-device-key-marker', issuedAtMs: at() }),
      (deviceKeyId: string) => ({ ...signedLease({ deviceKeyId, issuedAtMs: at() }), sig: 'AAAA' }),
    ];
    for (const make of bad) {
      h.premium.stub.on('lease', (request) => {
        const body = make(keyIdOf(request));
        sweep.issued.push(body);
        return { status: 200, body };
      });
      h.licence.trigger('refresh');
      await settle();
      await h.premium.clock.advance(16 * MINUTE);
    }

    expect(h.premium.log.events()).toContain('premium.lease_rejected');
    expectLicenceClean(sweep);
  });

  it('through a cleanup that reports, one that is refused or turned away, and a sign-out and restart with one owed', async () => {
    const reported = await holder();
    reported.h.premium.stub.on('lease', (request) => reported.h.lease(request, { state: 'moved', holderName: 'NEW-PC' }));
    reported.h.licence.trigger('refresh');
    await settle();
    await reported.h.restart();
    present(reported.h.stubRemoval).answerGone();
    await settle();
    expect(reported.h.licence.view().removalDone).toBe(true);
    expectLicenceClean(reported);

    const refused = await holder();
    refused.h.premium.stub.on('lease', (request) => refused.h.lease(request, { state: 'ended' }));
    refused.h.premium.stub.on('licenceCleanup', { status: 409, body: { reason: 'device_mismatch' } });
    refused.h.licence.trigger('refresh');
    await settle();
    present(refused.h.stubRemoval).answerGone();
    await settle();
    await refused.h.premium.clock.advance(6 * MINUTE);
    refused.h.premium.stub.on('licenceCleanup', { status: 503, body: { reason: 'busy' } });
    await refused.h.premium.clock.advance(6 * MINUTE);
    await refused.h.premium.service.signOut();
    await refused.h.restart();
    expectLicenceClean(refused);
  });

  it('through a restart that reads the sealed Lease and a sign-out that clears the session', async () => {
    const sweep = await holder();

    await sweep.h.restart();
    await sweep.h.premium.service.signOut();
    await settle();

    expect(sweep.h.licence.view().state).toBe('signed_out');
    expectLicenceClean(sweep);
  });
});

describe('the licence does nothing when the Premium surface is off', () => {
  it('generates no key, sends nothing and keeps the gate shut', async () => {
    const h = createLicenceHarness({ enabled: false });
    h.scriptHolder();

    await h.boot();
    await h.premium.clock.advance(2 * 60 * MINUTE);

    expect(h.store.deviceWrites).toEqual([]);
    expect(h.licenceRequests()).toEqual([]);
    expect(h.licence.view().state).toBe('signed_out');
    expect(h.gate.allows()).toBe(false);
  });
});

describe('the Premium host adds nothing secret to the view or the log', () => {
  const HOST_EVENTS = [
    'premium.bundle_fetch',
    'premium.bundle_verify',
    'premium.capability',
    'premium.host_start_failed',
    'premium.removal',
    'premium.ui_mount',
    'premium.worker_exit',
  ];
  const HOST_ARGS_MARKER = 'host-capability-args-marker-7741';
  let rig: HostRig | null = null;
  afterEach(async () => {
    await rig?.dispose();
    rig = null;
  });

  it('puts only a phase, two bundle URLs and the local-build flag in the view', async () => {
    rig = await createHostRig();
    const r = rig;
    const input = r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    const h = createHarness({
      vault: createFakeVault(session(SECRETS.token)),
      hostView: () => r.runner.view(),
    });
    h.service.start();
    await settle();

    const view = h.service.getView();
    expect(view.host).toEqual({
      phase: 'running',
      uiUrl: 'app://bundle/_premium/4/ui/index.js',
      styleUrl: 'app://bundle/_premium/4/ui/index.css',
      localBuild: false,
    });
    expect(Object.keys(view.host ?? {}).sort()).toEqual(['localBuild', 'phase', 'styleUrl', 'uiUrl']);
    const emitted = everyEmittedView(h);
    for (const secret of NEVER_EMITTED) expect(emitted, `emitted view holds ${secret}`).not.toContain(secret);
    for (const bytes of input.files.values()) {
      expect(emitted, 'emitted view holds bundle bytes').not.toContain(Buffer.from(bytes).toString('utf8'));
    }
  });

  it('logs only literal host events, each carrying strings, numbers and booleans, never an argument', async () => {
    rig = await createHostRig();
    const r = rig;
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    await r.workerHost()?.call(ECHO_CAPABILITY, { marker: HOST_ARGS_MARKER, token: SECRETS.token });
    r.runner.mountFailed();
    r.runner.requestPremiumRemoval('ended');
    await flush(r);

    expect(r.log.records.length).toBeGreaterThan(0);
    for (const record of r.log.records) {
      expect(record['scope']).toBe('premium');
      expect(HOST_EVENTS).toContain(record['event']);
      for (const value of Object.values(record)) expect(['string', 'number', 'boolean']).toContain(typeof value);
    }
    const logs = JSON.stringify(r.log.records);
    for (const secret of [...NEVER_LOGGED, HOST_ARGS_MARKER]) expect(logs, `log holds ${secret}`).not.toContain(secret);
  });
});
