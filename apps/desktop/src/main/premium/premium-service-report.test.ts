import { describe, expect, it } from 'vitest';
import {
  SECRETS,
  START_MS,
  createFakeVault,
  createHarness,
  deferred,
  session,
  settle,
  tokenBody,
  unreachable,
  type Harness,
  type StubReply,
} from './premium-test-support.js';

const OTHER_ACCOUNT = { accountId: 'account-fixture-9921', steamId64: '76561198099999999', playerName: null };
const LINKED = { accountId: SECRETS.accountId, steamId64: SECRETS.steamId64 };

async function signedInHarness(vaultSession = session(SECRETS.token)): Promise<Harness> {
  const h = createHarness({ vault: createFakeVault(vaultSession) });
  h.service.start();
  await settle();
  return h;
}

describe('what is sent', () => {
  it('posts exactly account_id and steam_id64 with the token, once, after a sign-in, when the name is unknown', async () => {
    const h = createHarness();
    await h.signedIn();

    const sent = h.stub.calls('report');
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0]?.body as object).sort()).toEqual(['account_id', 'steam_id64']);
    expect(sent[0]?.body).toEqual({ account_id: SECRETS.accountId, steam_id64: SECRETS.steamId64 });
    expect(sent[0]?.token).toBe(SECRETS.token);
  });

  it('builds the body from the listed fields only, so nothing else the reader holds can travel', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = {
      ...LINKED,
      playerName: 'Some Player',
      gameToken: SECRETS.gameToken,
      gold: 'gold-fixture-5150',
    } as unknown as typeof h.identity.current;
    h.service.start();
    await settle();

    const raw = h.stub.requests.map((request) => request.raw).join('\n');
    expect(h.stub.calls('report')).toHaveLength(1);
    expect(raw).not.toContain(SECRETS.gameToken);
    expect(raw).not.toContain('gold-fixture-5150');
    expect(h.stub.calls('report')[0]?.raw).toBe(
      JSON.stringify({ account_id: SECRETS.accountId, steam_id64: SECRETS.steamId64, player_name: 'Some Player' }),
    );
  });

  it('reports at start-up when signed in', async () => {
    const h = await signedInHarness();

    expect(h.stub.calls('report')).toHaveLength(1);
    expect(h.service.getView()).toMatchObject({ report: { kind: 'linked' }, reportedAccountId: SECRETS.accountId });
  });

  it('sends nothing at start-up or on an account change while signed out', async () => {
    const h = createHarness();
    h.service.start();
    await settle();

    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toEqual([]);
    expect(h.service.getView()).toMatchObject({ report: null, reportedAccountId: null });
  });

  it('uses the rotated token, with one rotation shared with the status fetch', async () => {
    const h = await signedInHarness(session(SECRETS.token, START_MS - 1));

    expect(h.stub.calls('rotate')).toHaveLength(1);
    expect(h.stub.calls('report')[0]?.token).toBe(SECRETS.rotatedToken);
    expect(h.stub.calls('status')[0]?.token).toBe(SECRETS.rotatedToken);
  });
});

describe('when it is sent', () => {
  it('does not resend the same pair, and sends a changed pair', async () => {
    const h = await signedInHarness();
    expect(h.stub.calls('report')).toHaveLength(1);

    h.service.noteAccountChanged();
    h.service.noteAccountChanged();
    await settle();
    expect(h.stub.calls('report')).toHaveLength(1);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });

    h.identity.current = OTHER_ACCOUNT;
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(2);
    expect(h.stub.calls('report')[1]?.body).toEqual({
      account_id: OTHER_ACCOUNT.accountId,
      steam_id64: OTHER_ACCOUNT.steamId64,
    });
    expect(h.service.getView().reportedAccountId).toBe(OTHER_ACCOUNT.accountId);
  });

  it('treats the same account with a different SteamID as a changed pair', async () => {
    const h = await signedInHarness();

    h.identity.current = { ...LINKED, steamId64: OTHER_ACCOUNT.steamId64, playerName: null };
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(2);
  });

  it('sends one report when the same trigger fires twice in one tick', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.service.start();
    h.service.noteAccountChanged();
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(1);
  });

  it('reports the same pair again in a new signed-in session', async () => {
    const h = await signedInHarness();
    await h.service.signOut();
    expect(h.service.getView()).toMatchObject({ report: null, reportedAccountId: null });

    await h.signedIn();

    expect(h.stub.calls('report')).toHaveLength(2);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('retries a failed send on the next trigger and never in a loop', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', (_request, count) => (count === 1 ? { status: 500 } : { status: 200, body: { outcome: 'linked' } }));
    h.service.start();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(1);
    expect(h.service.getView().report).toEqual({ kind: 'failed' });
    await h.clock.advance(30_000);
    expect(h.stub.calls('report')).toHaveLength(1);

    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(2);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('retries a refused send on the next trigger too, since the player may have fixed it on the website', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', (_request, count) =>
      count === 1 ? { status: 409, body: { reason: 'no_steam_id' } } : { status: 200, body: { outcome: 'linked' } },
    );
    h.service.start();
    await settle();
    expect(h.service.getView().report).toEqual({ kind: 'refused', reason: 'no_steam_id' });

    h.service.noteAccountChanged();
    await settle();

    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });
});

describe('the player name', () => {
  async function linkedWithName(playerName: string | null): Promise<Harness> {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = { ...LINKED, playerName };
    h.service.start();
    await settle();
    return h;
  }

  const sentNames = (h: Harness): unknown[] =>
    h.stub.calls('report').map((call) => (call.body as Record<string, unknown>)['player_name']);

  it('is sent trimmed beside the two ids when the app knows it', async () => {
    const h = await linkedWithName('  Some Player ');

    expect(h.stub.calls('report')[0]?.body).toEqual({
      account_id: SECRETS.accountId,
      steam_id64: SECRETS.steamId64,
      player_name: 'Some Player',
    });
  });

  it('is left out when the app does not know it', async () => {
    const h = await linkedWithName(null);

    expect(Object.keys(h.stub.calls('report')[0]?.body as object).sort()).toEqual(['account_id', 'steam_id64']);
  });

  it.each([
    ['an empty name', ''],
    ['a blank name', '   '],
    ['a name over 64 characters', 'x'.repeat(65)],
  ])('is left out, and the pair still sent, for %s', async (_name, playerName) => {
    const h = await linkedWithName(playerName);

    expect(Object.keys(h.stub.calls('report')[0]?.body as object).sort()).toEqual(['account_id', 'steam_id64']);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('is sent again when it changes, though the pair is already linked', async () => {
    const h = await linkedWithName('Some Player');

    h.identity.current = { ...LINKED, playerName: 'Renamed Player' };
    h.service.noteAccountChanged();
    await settle();

    expect(sentNames(h)).toEqual(['Some Player', 'Renamed Player']);
    expect(h.service.getView()).toMatchObject({ report: { kind: 'linked' }, reportedAccountId: SECRETS.accountId });
  });

  it('is sent once it first turns up after a link made without it', async () => {
    const h = await linkedWithName(null);

    h.identity.current = { ...LINKED, playerName: 'Some Player' };
    h.service.noteAccountChanged();
    await settle();

    expect(sentNames(h)).toEqual([undefined, 'Some Player']);
  });

  it('is not sent again while it stays the same, padding included', async () => {
    const h = await linkedWithName('Some Player');

    h.service.noteAccountChanged();
    h.identity.current = { ...LINKED, playerName: ' Some Player  ' };
    h.service.noteAccountChanged();
    await settle();

    expect(sentNames(h)).toEqual(['Some Player']);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('is not sent again when it goes unknown or invalid, nor when the same name comes back', async () => {
    const h = await linkedWithName('Some Player');

    for (const playerName of [null, '', 'x'.repeat(65), 'Some Player']) {
      h.identity.current = { ...LINKED, playerName };
      h.service.noteAccountChanged();
      await settle();
    }

    expect(sentNames(h)).toEqual(['Some Player']);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('is sent again on the next trigger after a changed name failed to send', async () => {
    const h = await linkedWithName('Some Player');
    h.stub.on('report', (_request, count) => (count === 2 ? { status: 500 } : { status: 200, body: { outcome: 'linked' } }));

    h.identity.current = { ...LINKED, playerName: 'Renamed Player' };
    h.service.noteAccountChanged();
    await settle();
    expect(h.service.getView().report).toEqual({ kind: 'failed' });

    h.service.noteAccountChanged();
    await settle();

    expect(sentNames(h)).toEqual(['Some Player', 'Renamed Player', 'Renamed Player']);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('is sent once when the same changed name triggers twice in one tick', async () => {
    const h = await linkedWithName('Some Player');

    h.identity.current = { ...LINKED, playerName: 'Renamed Player' };
    h.service.noteAccountChanged();
    h.service.noteAccountChanged();
    await settle();

    expect(sentNames(h)).toEqual(['Some Player', 'Renamed Player']);
  });

  it('is never sent while signed out', async () => {
    const h = createHarness();
    h.identity.current = { ...LINKED, playerName: 'Some Player' };
    h.service.start();
    await settle();

    h.identity.current = { ...LINKED, playerName: 'Renamed Player' };
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toEqual([]);
  });

  it('is never sent when the reader answers no identity, as it does without game-API consent', async () => {
    const h = await linkedWithName('Some Player');

    h.identity.current = null;
    h.service.noteAccountChanged();
    await settle();

    expect(sentNames(h)).toEqual(['Some Player']);
    expect(h.service.getView().report).toEqual({ kind: 'not-sent', reason: 'no-game-account' });
  });

  it('is sent again in a new signed-in session', async () => {
    const h = await linkedWithName('Some Player');
    await h.service.signOut();

    await h.signedIn();

    expect(sentNames(h)).toEqual(['Some Player', 'Some Player']);
  });
});

describe('the outcome', () => {
  const outcomes: [string, StubReply | (() => Promise<StubReply>), object][] = [
    ['a 200 linked', { status: 200, body: { outcome: 'linked' } }, { kind: 'linked' }],
    ['a 409 steam_mismatch', { status: 409, body: { reason: 'steam_mismatch' } }, { kind: 'refused', reason: 'steam_mismatch' }],
    ['a 409 no_steam_id', { status: 409, body: { reason: 'no_steam_id' } }, { kind: 'refused', reason: 'no_steam_id' }],
    [
      'a 409 game_account_taken',
      { status: 409, body: { reason: 'game_account_taken' } },
      { kind: 'refused', reason: 'game_account_taken' },
    ],
    ['a 409 with a reason it does not know', { status: 409, body: { reason: 'brand_new' } }, { kind: 'refused', reason: 'unknown' }],
    ['a 400', { status: 400, body: { reason: 'bad' } }, { kind: 'failed' }],
    ['a 500', { status: 500 }, { kind: 'failed' }],
    ['a 200 with another outcome', { status: 200, body: { outcome: 'pending' } }, { kind: 'failed' }],
    ['a network failure', unreachable, { kind: 'failed' }],
  ];

  it.each(outcomes)('is stored with the account id after %s', async (_name, reply, expected) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', reply);
    h.service.start();
    await settle();

    expect(h.service.getView()).toMatchObject({ report: expected, reportedAccountId: SECRETS.accountId });
    expect(h.service.getView().session).toBe('signed-in');
  });

  it('logs the outcome kind and the refusal reason, never an id', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', { status: 409, body: { reason: 'game_account_taken' } });
    h.service.start();
    await settle();

    expect(h.log.records).toContainEqual({
      scope: 'premium',
      event: 'report.outcome',
      outcome: 'refused',
      reason: 'game_account_taken',
    });
  });
});

describe('when nothing can be sent', () => {
  it('says there is no game account to read and sends nothing', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = null;
    h.service.start();
    await settle();

    expect(h.stub.calls('report')).toEqual([]);
    expect(h.service.getView()).toMatchObject({
      report: { kind: 'not-sent', reason: 'no-game-account' },
      reportedAccountId: null,
    });
  });

  it.each([
    ['no SteamID', null],
    ['an empty SteamID', ''],
    ['a short SteamID', '7656119801234567'],
    ['a long SteamID', '765611980123456789'],
    ['a SteamID with letters', '7656119801234567a'],
  ])('says the SteamID is missing and sends nothing for %s', async (_name, steamId64) => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = { accountId: SECRETS.accountId, steamId64, playerName: 'Some Player' };
    h.service.start();
    await settle();

    expect(h.stub.calls('report')).toEqual([]);
    expect(h.service.getView()).toMatchObject({ report: { kind: 'not-sent', reason: 'no-steam-id' } });
  });

  it('sends once the SteamID turns up on the next account change', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.identity.current = { accountId: SECRETS.accountId, steamId64: null, playerName: null };
    h.service.start();
    await settle();

    h.identity.current = { ...LINKED, playerName: null };
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(1);
    expect(h.service.getView().report).toEqual({ kind: 'linked' });
  });

  it('shows linked again, without sending, when the same pair comes back after an unreadable moment', async () => {
    const h = await signedInHarness();

    h.identity.current = null;
    h.service.noteAccountChanged();
    await settle();
    expect(h.service.getView().report).toEqual({ kind: 'not-sent', reason: 'no-game-account' });

    h.identity.current = { ...LINKED, playerName: null };
    h.service.noteAccountChanged();
    await settle();

    expect(h.stub.calls('report')).toHaveLength(1);
    expect(h.service.getView()).toMatchObject({ report: { kind: 'linked' }, reportedAccountId: SECRETS.accountId });
  });
});

describe('a 401', () => {
  it('on the report clears the token and the cache and reports the sign-in ended', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', { status: 401 });
    h.service.start();
    await settle();

    expect(h.service.getView()).toMatchObject({
      session: 'signed-out',
      ended: 'expired',
      status: null,
      report: null,
      reportedAccountId: null,
    });
    expect(h.vault.held()).toBeNull();
    expect(h.cache.read()).toBeNull();
  });
});

describe('an answer that lands after sign-out', () => {
  it('is dropped: the report outcome is not stored on the signed-out view', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
    h.stub.on('report', () => gate.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 200, body: { outcome: 'linked' } });
    await settle();

    expect(h.service.getView()).toMatchObject({ session: 'signed-out', report: null, reportedAccountId: null });
    expect(h.log.events()).not.toContain('report.outcome');
  });

  it('is dropped: a rotation that finishes after sign-out sends no report', async () => {
    const gate = deferred<StubReply>();
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token, START_MS - 1)) });
    h.stub.on('rotate', () => gate.promise);
    h.service.start();
    await settle();

    await h.service.signOut();
    gate.resolve({ status: 200, body: tokenBody(SECRETS.rotatedToken) });
    await settle();

    expect(h.stub.calls('report')).toEqual([]);
  });
});
