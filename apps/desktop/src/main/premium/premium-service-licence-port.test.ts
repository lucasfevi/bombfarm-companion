import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUS_BODY,
  INACTIVE_STATUS_BODY,
  ME_BODY,
  SECRETS,
  START_MS,
  createFakeSubjectStore,
  createFakeVault,
  createHarness,
  session,
  settle,
  type Harness,
} from './premium-test-support.js';

const USER = 'user-subject-marker-0001';
const ME_WITH_USER = { ...ME_BODY, userId: USER };

function signedIn(options: { subject?: string | null; rotateAfterMs?: number } = {}): Harness {
  const h = createHarness({
    vault: createFakeVault(session(SECRETS.token, options.rotateAfterMs)),
    subjects: createFakeSubjectStore(options.subject ?? null),
  });
  h.stub.on('me', { status: 200, body: ME_WITH_USER });
  return h;
}

async function started(h: Harness): Promise<Harness> {
  h.service.start();
  await settle();
  return h;
}

describe('the licence host port: subject and onSession', () => {
  it('learns the user id from the account answer, seals it once, and tells session listeners', async () => {
    const h = signedIn();
    const told: Array<string | null> = [];
    h.service.host.onSession((subject) => told.push(subject));

    await started(h);
    await h.service.refresh('button');
    await h.clock.advance(60_000);
    await h.service.refresh('button');

    expect(h.service.host.subject()).toBe(USER);
    expect(told).toEqual([USER]);
    expect(h.subjects.stores).toEqual([USER]);
  });

  it('answers null when the account answer carries no user id, and seals nothing', async () => {
    const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });

    await started(h);

    expect(h.service.host.subject()).toBeNull();
    expect(h.subjects.stores).toEqual([]);
  });

  it('knows the sealed subject at start, before the account answers', () => {
    const h = signedIn({ subject: USER });
    const told: Array<string | null> = [];
    h.service.host.onSession((subject) => told.push(subject));
    h.stub.on('me', () => new Promise(() => undefined));

    h.service.start();

    expect(h.service.host.subject()).toBe(USER);
    expect(told).toEqual([USER]);
  });

  it('ignores a sealed subject when there is no session to belong to', () => {
    const h = createHarness({ subjects: createFakeSubjectStore(USER) });

    h.service.start();

    expect(h.service.host.subject()).toBeNull();
  });

  it('forgets the subject, in memory and sealed, and tells listeners null on sign-out', async () => {
    const h = await started(signedIn());
    const told: Array<string | null> = [];
    h.service.host.onSession((subject) => told.push(subject));

    await h.service.signOut();

    expect(told).toEqual([null]);
    expect(h.service.host.subject()).toBeNull();
    expect(h.subjects.held()).toBeNull();
  });

  it('forgets the subject the same way when the session expires on a 401', async () => {
    const h = await started(signedIn());
    const told: Array<string | null> = [];
    h.service.host.onSession((subject) => told.push(subject));
    h.stub.on('status', { status: 401 });
    h.stub.on('me', { status: 401 });

    await h.clock.advance(3_600_000);

    expect(h.service.getView().session).toBe('signed-out');
    expect(told).toEqual([null]);
    expect(h.service.host.subject()).toBeNull();
    expect(h.subjects.held()).toBeNull();
  });

  it('stops telling a listener once it unsubscribed, and a throwing listener does not stop the others', async () => {
    const h = signedIn();
    const told: Array<string | null> = [];
    h.service.host.onSession(() => {
      throw new Error('listener fault');
    });
    const unsubscribed: Array<string | null> = [];
    const stop = h.service.host.onSession((subject) => unsubscribed.push(subject));
    stop();
    h.service.host.onSession((subject) => told.push(subject));

    await started(h);

    expect(told).toEqual([USER]);
    expect(unsubscribed).toEqual([]);
    expect(h.service.getView().session).toBe('signed-in');
  });
});

describe('the licence host port: onStatus', () => {
  it('tells listeners the active flag after each status fetch that answered', async () => {
    const h = signedIn();
    const told: boolean[] = [];
    h.service.host.onStatus((active) => told.push(active));
    h.stub.on('status', { status: 200, body: ACTIVE_STATUS_BODY });

    await started(h);
    h.stub.on('status', { status: 200, body: INACTIVE_STATUS_BODY });
    await h.clock.advance(3_600_000);

    expect(told).toEqual([true, false]);
  });

  it('says nothing for a status fetch that failed', async () => {
    const h = signedIn();
    const told: boolean[] = [];
    h.service.host.onStatus((active) => told.push(active));
    h.stub.on('status', { status: 503 });

    await started(h);

    expect(told).toEqual([]);
  });
});

describe('the licence host port: withBearer', () => {
  it('runs the call with the current token', async () => {
    const h = await started(signedIn());

    const result = await h.service.host.withBearer((token) => Promise.resolve(`used:${token}`));

    expect(result).toBe(`used:${SECRETS.token}`);
  });

  it('rotates a due token first, as every other request does', async () => {
    const h = signedIn({ rotateAfterMs: START_MS - 1000 });
    h.service.start();

    const result = await h.service.host.withBearer((token) => Promise.resolve(`used:${token}`));

    expect(result).toBe(`used:${SECRETS.rotatedToken}`);
    expect(h.stub.calls('rotate')).toHaveLength(1);
  });

  it('ends the session on the same 401 path when the result is a bearer refusal', async () => {
    const h = await started(signedIn());
    const told: Array<string | null> = [];
    h.service.host.onSession((subject) => told.push(subject));

    const result = await h.service.host.withBearer(
      () => Promise.resolve({ refused: true }),
      (answer) => answer.refused,
    );

    expect(result).toEqual({ refused: true });
    expect(h.service.getView().session).toBe('signed-out');
    expect(h.service.getView().ended).toBe('expired');
    expect(told).toEqual([null]);
  });

  it('leaves the session alone when the result is not a refusal', async () => {
    const h = await started(signedIn());

    await h.service.host.withBearer(
      () => Promise.resolve({ refused: false }),
      (answer) => answer.refused,
    );

    expect(h.service.getView().session).toBe('signed-in');
  });

  it('answers unauthorized without calling when there is no session', async () => {
    const h = createHarness();
    let called = 0;

    const result = await h.service.host.withBearer(() => {
      called += 1;
      return Promise.resolve('x');
    });

    expect(result).toBe('unauthorized');
    expect(called).toBe(0);
  });
});

describe('the licence host port: pair and onPair', () => {
  const PAIR = { accountId: SECRETS.accountId, steamId64: SECRETS.steamId64 };

  it('reads the pair the session reports, and tells listeners once the account state has followed', async () => {
    const h = signedIn();
    const seen: Array<{ pair: unknown; account: string }> = [];
    h.service.host.onPair(() => seen.push({ pair: h.service.host.pair(), account: h.playing.current().state }));

    await started(h);

    expect(h.service.host.pair()).toEqual(PAIR);
    expect(seen).toEqual([{ pair: PAIR, account: 'unknown' }]);
  });

  it('follows a change of the game account and reads null when the game is not read', async () => {
    const h = await started(signedIn());
    let told = 0;
    h.service.host.onPair(() => {
      told += 1;
    });

    h.identity.current = { accountId: 'account-other-0002', steamId64: '76561198000000002', playerName: null };
    h.service.noteAccountChanged();
    await settle();
    expect(h.service.host.pair()).toEqual({ accountId: 'account-other-0002', steamId64: '76561198000000002' });

    h.identity.current = null;
    h.service.noteAccountChanged();
    await settle();

    expect(h.service.host.pair()).toBeNull();
    expect(told).toBe(2);
  });

  it('tells nothing when the same pair is read again', async () => {
    const h = await started(signedIn());
    let told = 0;
    h.service.host.onPair(() => {
      told += 1;
    });

    h.service.noteAccountChanged();
    await settle();

    expect(told).toBe(0);
  });

  it('reads null after sign-out', async () => {
    const h = await started(signedIn());

    await h.service.signOut();

    expect(h.service.host.pair()).toBeNull();
  });
});
