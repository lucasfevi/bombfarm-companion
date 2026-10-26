import type { PremiumPlayingAccount } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  SECRETS,
  createFakeVault,
  createHarness,
  deferred,
  session,
  settle,
  unreachable,
  type Harness,
  type StubReply,
} from './premium-test-support.js';
import type { GameIdentity } from './premium-service.js';

const PAIR_A: GameIdentity = { accountId: SECRETS.accountId, steamId64: SECRETS.steamId64, playerName: null };
const PAIR_B: GameIdentity = { accountId: 'account-fixture-9921', steamId64: '76561198099999999', playerName: null };

const LINKED: PremiumPlayingAccount = { state: 'linked', reason: null };
const CHECKING: PremiumPlayingAccount = { state: 'unknown', reason: 'checking' };
const SIGNED_OUT: PremiumPlayingAccount = { state: 'unknown', reason: 'signed_out' };

async function signedIn(): Promise<Harness> {
  const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
  h.service.start();
  await settle();
  return h;
}

function refusedWith(reason: string): StubReply {
  return { status: 409, body: { reason } };
}

/** Answers each report from the SteamID it carries. */
function answerBySteamId(h: Harness, replies: Record<string, StubReply | 'down'>): void {
  h.stub.on('report', (request) => {
    const steamId = (request.body as { steam_id64: string }).steam_id64;
    const reply = replies[steamId] ?? { status: 200, body: { outcome: 'linked' } };
    return reply === 'down' ? unreachable() : reply;
  });
}

function switchTo(h: Harness, pair: GameIdentity | null): void {
  h.identity.current = pair;
  h.service.noteAccountChanged();
}

describe('the playing-account state', () => {
  it('is unknown, signed out, while nobody is signed in', async () => {
    const h = createHarness();
    h.service.start();
    await settle();

    expect(h.service.getView().playingAccount).toEqual(SIGNED_OUT);
    expect(h.playing.allows()).toBe(false);
  });

  it('is unknown, no session, when signed in but no game session is read', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = null;
    h.service.start();
    await settle();

    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'no_session' });
  });

  it.each([
    ['no SteamID', null],
    ['a 16-digit SteamID', '7656119801234567'],
    ['a SteamID with a letter', '7656119801234567x'],
  ])('is unknown, no SteamID, for an account id with %s, and never linked from the account id alone', async (_label, steamId64) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = { accountId: SECRETS.accountId, steamId64, playerName: null };
    h.service.start();
    await settle();

    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'no_steam_id64' });
    expect(h.playing.allows()).toBe(false);
    expect(h.stub.calls('report')).toEqual([]);
  });

  it('goes to checking before any report is sent, then linked when the report answers linked', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    const answer = deferred<StubReply>();
    h.stub.on('report', () => answer.promise);
    const seen: PremiumPlayingAccount[] = [];
    const reportsAtChange: number[] = [];
    h.playing.subscribe((next) => {
      seen.push(next);
      reportsAtChange.push(h.stub.calls('report').length);
    });

    h.service.start();
    expect(h.service.getView().playingAccount).toEqual(CHECKING);
    expect(h.stub.calls('report')).toEqual([]);
    await settle();
    expect(h.stub.calls('report')).toHaveLength(1);
    expect(h.service.getView().playingAccount).toEqual(CHECKING);

    answer.resolve({ status: 200, body: { outcome: 'linked' } });
    await settle();

    expect(seen).toEqual([CHECKING, LINKED]);
    expect(reportsAtChange).toEqual([0, 1]);
    expect(h.service.getView().playingAccount).toEqual(LINKED);
    expect(h.playing.allows()).toBe(true);
  });

  it.each([
    ['steam_mismatch', { state: 'other', reason: 'other_account' }],
    ['game_account_taken', { state: 'other', reason: 'other_account' }],
    ['no_steam_id', { state: 'other', reason: 'no_steam_link' }],
  ] as const)('is %s → %o', async (refusal, expected) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', refusedWith(refusal));
    h.service.start();
    await settle();

    expect(h.service.getView().playingAccount).toEqual(expected);
    expect(h.playing.allows()).toBe(false);
  });

  it.each<[string, StubReply | 'down']>([
    ['unreachable', 'down'],
    ['a 500', { status: 500 }],
    ['a 503', { status: 503 }],
    ['a 429', { status: 429 }],
    ['an unknown 409', refusedWith('something_new')],
    ['a 400', { status: 400, body: { reason: 'invalid_body' } }],
    ['an unreadable 200', { status: 200, body: { outcome: 'maybe' } }],
  ])('is unknown, report failed, when the report gets %s', async (_label, reply) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', () => (reply === 'down' ? unreachable() : reply));
    h.service.start();
    await settle();

    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'report_failed' });
    expect(h.playing.allows()).toBe(false);
  });
});

describe('a change of the session pair', () => {
  it('drops a linked state to checking at once, before the new pair is reported', async () => {
    const h = await signedIn();
    expect(h.service.getView().playingAccount).toEqual(LINKED);
    const answer = deferred<StubReply>();
    h.stub.on('report', () => answer.promise);
    const reportsBefore = h.stub.calls('report').length;
    const notified: { next: PremiumPlayingAccount; reportsSoFar: number }[] = [];
    h.playing.subscribe((next) => notified.push({ next, reportsSoFar: h.stub.calls('report').length }));

    switchTo(h, PAIR_B);

    expect(h.playing.allows()).toBe(false);
    expect(h.service.getView().playingAccount).toEqual(CHECKING);
    expect(h.views.at(-1)?.playingAccount).toEqual(CHECKING);
    expect(notified).toEqual([{ next: CHECKING, reportsSoFar: reportsBefore }]);
    await settle();
    expect(h.stub.calls('report')).toHaveLength(reportsBefore + 1);
    answer.resolve(refusedWith('steam_mismatch'));
    await settle();
    expect(h.service.getView().playingAccount).toEqual({ state: 'other', reason: 'other_account' });
  });

  it('treats a first pair after no session as a change', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = null;
    h.service.start();
    await settle();
    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'no_session' });

    switchTo(h, PAIR_A);

    expect(h.service.getView().playingAccount).toEqual(CHECKING);
    await settle();
    expect(h.service.getView().playingAccount).toEqual(LINKED);
  });

  it('A linked, B refused, back to A: linked again at once with no request sent', async () => {
    const h = await signedIn();
    answerBySteamId(h, { [String(PAIR_B.steamId64)]: refusedWith('steam_mismatch') });
    expect(h.service.getView().playingAccount).toEqual(LINKED);

    switchTo(h, PAIR_B);
    expect(h.service.getView().playingAccount).toEqual(CHECKING);
    await settle();
    expect(h.service.getView().playingAccount).toEqual({ state: 'other', reason: 'other_account' });
    const reportsSoFar = h.stub.calls('report').length;

    switchTo(h, PAIR_A);

    expect(h.service.getView().playingAccount).toEqual(LINKED);
    expect(h.playing.allows()).toBe(true);
    await settle();
    expect(h.stub.calls('report')).toHaveLength(reportsSoFar);
  });

  it('keeps an unchanged pair where it is when the account signal repeats', async () => {
    const h = await signedIn();
    answerBySteamId(h, { [String(PAIR_B.steamId64)]: refusedWith('steam_mismatch') });
    switchTo(h, PAIR_B);
    await settle();
    const seen: PremiumPlayingAccount[] = [];
    h.playing.subscribe((next) => seen.push(next));

    switchTo(h, PAIR_B);
    await settle();

    expect(seen).toEqual([]);
    expect(h.service.getView().playingAccount).toEqual({ state: 'other', reason: 'other_account' });
  });

  it('a pair whose link was refused later is not vouched for by its earlier answer', async () => {
    const h = await signedIn();
    h.identity.current = { ...PAIR_A, playerName: 'New Name' };
    h.stub.on('report', refusedWith('game_account_taken'));
    h.service.noteAccountChanged();
    await settle();
    expect(h.service.getView().playingAccount).toEqual({ state: 'other', reason: 'other_account' });
    h.stub.on('report', () => ({ status: 200, body: { outcome: 'linked' } }));

    switchTo(h, PAIR_B);
    await settle();
    const answer = deferred<StubReply>();
    h.stub.on('report', () => answer.promise);
    switchTo(h, PAIR_A);

    expect(h.service.getView().playingAccount).toEqual(CHECKING);
  });

  it('a name-only re-report that fails keeps a linked pair linked', async () => {
    const h = await signedIn();
    h.identity.current = { ...PAIR_A, playerName: 'New Name' };
    h.stub.on('report', () => unreachable());
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report').at(-1)?.body).toMatchObject({ player_name: 'New Name' });
    expect(h.service.getView().playingAccount).toEqual(LINKED);
  });

  it('counts only the answer for the last pair when two changes outrun the report', async () => {
    const h = await signedIn();
    const forB = deferred<StubReply>();
    const forC = deferred<StubReply>();
    const PAIR_C: GameIdentity = { accountId: 'account-fixture-3307', steamId64: '76561198077777777', playerName: null };
    h.stub.on('report', (request) =>
      (request.body as { steam_id64: string }).steam_id64 === PAIR_B.steamId64 ? forB.promise : forC.promise,
    );

    switchTo(h, PAIR_B);
    await settle();
    switchTo(h, PAIR_C);
    await settle();
    forB.resolve({ status: 200, body: { outcome: 'linked' } });
    await settle();

    expect(h.service.getView().playingAccount).toEqual(CHECKING);
    expect(h.service.getView().reportedAccountId).not.toBe(PAIR_B.accountId);

    forC.resolve(refusedWith('steam_mismatch'));
    await settle();
    expect(h.service.getView().playingAccount).toEqual({ state: 'other', reason: 'other_account' });

    switchTo(h, PAIR_B);
    expect(h.service.getView().playingAccount).toEqual(CHECKING);
  });

  it('drops to no session when the game session goes away', async () => {
    const h = await signedIn();

    switchTo(h, null);

    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'no_session' });
    expect(h.playing.allows()).toBe(false);
  });
});

describe('sign-out, expiry and restarts', () => {
  it('goes to signed out on sign-out, and forgets which pairs were linked', async () => {
    const h = await signedIn();
    expect(h.playing.allows()).toBe(true);

    await h.service.signOut();
    expect(h.service.getView().playingAccount).toEqual(SIGNED_OUT);
    expect(h.playing.allows()).toBe(false);

    const answer = deferred<StubReply>();
    h.stub.on('report', () => answer.promise);
    await h.signedIn();
    expect(h.service.getView().playingAccount).toEqual(CHECKING);
  });

  it('goes to signed out on a 401, and forgets which pairs were linked', async () => {
    const h = await signedIn();
    h.stub.on('report', { status: 401 });
    switchTo(h, PAIR_B);
    await settle();

    expect(h.service.getView().session).toBe('signed-out');
    expect(h.service.getView().playingAccount).toEqual(SIGNED_OUT);

    h.stub.on('report', () => deferred<StubReply>().promise);
    h.identity.current = PAIR_A;
    await h.signedIn();
    expect(h.service.getView().playingAccount).toEqual(CHECKING);
  });

  it('discards a report answer that arrives after sign-out', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    const answer = deferred<StubReply>();
    h.stub.on('report', () => answer.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    answer.resolve({ status: 200, body: { outcome: 'linked' } });
    await settle();

    expect(h.service.getView().playingAccount).toEqual(SIGNED_OUT);
    expect(h.playing.allows()).toBe(false);
  });

  it('starts from nothing: a fresh service with a stored sign-in checks again rather than remembering linked', async () => {
    const vault = createFakeVault(session(SECRETS.token));
    const first = createHarness({ vault });
    first.service.start();
    await settle();
    expect(first.playing.allows()).toBe(true);
    first.service.stop();
    expect(first.playing.allows()).toBe(false);

    const second = createHarness({ vault });
    const answer = deferred<StubReply>();
    second.stub.on('report', () => answer.promise);
    second.service.start();

    expect(second.service.getView().playingAccount).toEqual(CHECKING);
  });

  it('writes the state to neither the vault nor the cache', async () => {
    const h = await signedIn();
    answerBySteamId(h, { [String(PAIR_B.steamId64)]: refusedWith('no_steam_id') });
    switchTo(h, PAIR_B);
    await settle();

    const written = JSON.stringify([h.vault.stores, h.cache.writes]);
    expect(written).not.toContain('playingAccount');
    expect(written).not.toContain('no_steam_link');
    expect(written).not.toContain('checking');
    expect(written).not.toContain('"linked"');
  });
});

describe('the state change log', () => {
  it('logs each change as the state and the reason word only', async () => {
    const h = await signedIn();
    answerBySteamId(h, { [String(PAIR_B.steamId64)]: refusedWith('steam_mismatch') });
    switchTo(h, PAIR_B);
    await settle();

    const changes = h.log.records.filter((record) => record['event'] === 'account_state');
    expect(changes).toEqual([
      { scope: 'premium', event: 'account_state', state: 'unknown', reason: 'checking' },
      { scope: 'premium', event: 'account_state', state: 'linked' },
      { scope: 'premium', event: 'account_state', state: 'unknown', reason: 'checking' },
      { scope: 'premium', event: 'account_state', state: 'other', reason: 'other_account' },
    ]);
  });
});

describe('retrying a failed report', () => {
  async function failedOnce(): Promise<Harness> {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', () => unreachable());
    h.service.start();
    await settle();
    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'report_failed' });
    return h;
  }

  it('re-sends the report for the current pair when Refresh runs', async () => {
    const h = await failedOnce();
    const sent = h.stub.calls('report').length;
    h.stub.on('report', () => ({ status: 200, body: { outcome: 'linked' } }));
    await h.clock.advance(31_000);

    expect(await h.service.refresh('button')).toEqual({ ok: true });
    await settle();

    expect(h.stub.calls('report')).toHaveLength(sent + 1);
    expect(h.stub.calls('report').at(-1)?.body).toMatchObject({
      account_id: SECRETS.accountId,
      steam_id64: SECRETS.steamId64,
    });
    expect(h.service.getView().playingAccount).toEqual(LINKED);
  });

  it('does not re-send when the refresh is refused as too soon', async () => {
    const h = await failedOnce();
    const sent = h.stub.calls('report').length;

    expect(await h.service.refresh('button')).toEqual({ ok: false, reason: 'too-soon' });
    await settle();

    expect(h.stub.calls('report')).toHaveLength(sent);
  });

  it('does not re-send on Refresh when the state is anything but a failed report', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', refusedWith('steam_mismatch'));
    h.service.start();
    await settle();
    const sent = h.stub.calls('report').length;
    await h.clock.advance(31_000);

    expect(await h.service.refresh('button')).toEqual({ ok: true });
    await settle();

    expect(h.stub.calls('report')).toHaveLength(sent);
  });

  it('never retries by itself: an hour of timers sends no second report', async () => {
    const h = await failedOnce();
    const sent = h.stub.calls('report').length;

    await h.clock.advance(3 * 3_600_000);

    expect(h.stub.calls('report')).toHaveLength(sent);
    expect(h.service.getView().playingAccount).toEqual({ state: 'unknown', reason: 'report_failed' });
  });
});
