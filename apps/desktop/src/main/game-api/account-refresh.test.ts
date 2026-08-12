import { beforeAll, describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountView } from '@bombfarm/contracts';
import type {
  ConsentRecord,
  GrantedConsent,
  HttpResponse,
  HttpTransport,
  PacingClock,
  SessionToken,
} from '@bombfarm/game-api';
import { SessionToken as SessionTokenClass, createPacingGate } from '@bombfarm/game-api';
import type { AccountStore } from '../storage/account-store.js';
import { createAccountStore } from '../storage/account-store.js';
import type { SqliteBinding, SqliteDb, SqliteStatement } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createAccountRefresh, type AccountRefreshDeps } from './account-refresh.js';
import type { ConsentStore } from './consent-store.js';
import type { SessionTokenFileResult } from './session-token-file.js';

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

/** Every call site below wants "a real, available binding" — this fails loudly (never a silent
 *  skip) if none is available, rather than repeating a non-null assertion at every call site. */
function firstBinding(): SqliteBinding {
  const binding = AVAILABLE_BINDINGS[0];
  if (!binding) {
    throw new Error('no SQLite binding available in this environment — cannot run this suite');
  }
  return binding;
}

const SENTINEL_TOKEN = 'sentinel-account-refresh-8b1e4d92-do-not-leak';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
const DECLINED: ConsentRecord = { decision: 'declined', textVersion: 1 };
const UNASKED: ConsentRecord = { decision: 'unasked', textVersion: 1 };

function noopLog(): { info: () => void; warn: () => void; error: () => void } {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

/** `AccountPayload.fidelity` is optional at the type level (a source-neutral payload with no
 *  fidelity block is legal in general), but every payload this module's cycle produces always
 *  carries one — this narrows that for the tests below without a banned non-null assertion. */
function fidelityOf(view: AccountView | null): AccountFidelity {
  if (!view?.payload.fidelity) {
    throw new Error('expected a committed view with a fidelity block');
  }
  return view.payload.fidelity;
}

function fakeGate() {
  const clock: PacingClock = {
    now: () => 0,
    sleep: () => Promise.resolve(),
  };
  return createPacingGate(clock);
}

function fixedConsentStore(record: ConsentRecord): ConsentStore {
  let current = record;
  return {
    read: () => current,
    write: (next) => {
      current = next;
    },
  };
}

function throwingReadToken(): (consent: GrantedConsent) => SessionTokenFileResult {
  return () => {
    throw new Error('readToken must never be called for this scenario');
  };
}

function fixedReadToken(accountId: string, token: SessionToken, mtimeMs: number) {
  let calls = 0;
  const fn = (): SessionTokenFileResult => {
    calls += 1;
    return { ok: true, accountId, token, mtimeMs };
  };
  return { fn, callCount: () => calls };
}

const BODIES: Record<string, Record<string, unknown>> = {
  '/state': { gold: 100, phase: 5, max_phase: 10, locked: false, chests: [], bag_tabs: 4, bag_capacity: 100, items_count: 2 },
  '/roster': { heroes: [{ id: '1', name: 'Nyx' }] },
  '/skill/state': { levels: {}, totals: {}, gold: 100, max_phase: 10, refunds: 0, field_slots: 3 },
  '/rotation': { field_size: 9, heroes: [], casa: { active_casa: 1, levels: [1] } },
  '/inventory': { items: [{ id: '1' }], bag_tabs: 4, bag_capacity: 100, items_count: 1 },
};

function okTransport(calls: string[] = []): HttpTransport {
  return (req) => {
    calls.push(req.path);
    return Promise.resolve({ status: 200, body: JSON.stringify(BODIES[req.path] ?? {}) });
  };
}

function throwingTransport(): HttpTransport {
  return () => {
    throw new Error('transport must never be called for this scenario');
  };
}

/** Records every value bound into a `.run()`/`.get()`/`.all()` call, not just the SQL text —
 *  `storage/test-support.ts`'s `wrapWithRecording` only records SQL, so the token-leak guard
 *  needs its own wrapper (kept local; `apps/desktop/src/main/storage` is not touched by T8). */
function wrapWithValueRecording(db: SqliteDb): { db: SqliteDb; values: unknown[] } {
  const values: unknown[] = [];
  const wrapStatement = (stmt: SqliteStatement): SqliteStatement => ({
    run: (...params: unknown[]) => {
      values.push(...params);
      return stmt.run(...params);
    },
    get: (...params: unknown[]) => {
      values.push(...params);
      return stmt.get(...params);
    },
    all: (...params: unknown[]) => {
      values.push(...params);
      return stmt.all(...params);
    },
  });
  return {
    db: {
      exec: (sql) => {
        db.exec(sql);
      },
      prepare: (sql) => wrapStatement(db.prepare(sql)),
      close: () => {
        db.close();
      },
    },
    values,
  };
}

function baseDeps(overrides: Partial<AccountRefreshDeps> & { store: AccountStore }): AccountRefreshDeps {
  let tick = 0;
  return {
    consentStore: fixedConsentStore(UNASKED),
    transport: throwingTransport(),
    gate: fakeGate(),
    log: noopLog(),
    now: () => {
      tick += 1;
      return `2026-08-12T00:0${String(tick)}:00.000Z`;
    },
    readToken: throwingReadToken(),
    ...overrides,
  };
}

describe('account-refresh — unasked consent (LAR-01)', () => {
  it('ran against at least one SQLite binding', () => {
    expect(AVAILABLE_BINDINGS.length).toBeGreaterThan(0);
  });

  it('issues zero transport calls and zero FsPort/readToken calls', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(UNASKED),
      transport: (req) => {
        transportCalls.push(req.path);
        return Promise.reject(new Error('transport must never be called while unasked'));
      },
      readToken: throwingReadToken(),
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(transportCalls).toEqual([]);
    expect(view).not.toBeNull();
  });
});

describe('account-refresh — declined consent (LAR-04)', () => {
  it('issues zero requests and commits an all-missing payload so the stored account keeps serving', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(DECLINED),
      transport: throwingTransport(),
      readToken: throwingReadToken(),
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(view).not.toBeNull();
    for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as const) {
      expect(fidelityOf(view)[section].status).toBe('missing');
    }
    // The app stays usable: commit() was still called and returned a servable view.
    expect(view?.store).toBeDefined();
  });
});

describe('account-refresh — consent changing to granted (LAR-03)', () => {
  it('starts a cycle immediately via onConsentChanged, without calling start() or restarting anything', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const consentStore = fixedConsentStore(UNASKED);
    const deps = baseDeps({
      store,
      consentStore,
      transport: okTransport(transportCalls),
      readToken,
    });
    const refresh = createAccountRefresh(deps);

    // A real caller (T9's consent:accept IPC handler) persists the decision first, then
    // notifies the cycle — onConsentChanged is a trigger, not itself a source of the record.
    consentStore.write(GRANTED);
    // start() is never called — onConsentChanged alone must trigger the cycle.
    refresh.onConsentChanged(GRANTED);

    // Flush the fire-and-forget cycle triggered by onConsentChanged.
    for (let i = 0; i < 10 && transportCalls.length < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(transportCalls.sort()).toEqual(['/inventory', '/roster', '/rotation', '/skill/state', '/state'].sort());
    expect(fidelityOf(refresh.getLastView()).account.status).toBe('resolved');
  });
});

describe('account-refresh — revoke mid-cycle (LAR-05)', () => {
  it('aborts the in-flight request, commits what was already read, and requests nothing further', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    let releaseRoster: ((res: HttpResponse) => void) | null = null;

    const transport: HttpTransport = (req) => {
      transportCalls.push(req.path);
      if (req.path === '/roster') {
        return new Promise((resolve) => {
          releaseRoster = resolve;
        });
      }
      return Promise.resolve({ status: 200, body: JSON.stringify(BODIES[req.path] ?? {}) });
    };

    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const deps = baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport, readToken });
    const refresh = createAccountRefresh(deps);

    const cyclePromise = refresh.refreshNow();

    // Wait until /roster has been called (i.e. /state already resolved and committed as ok).
    for (let i = 0; i < 50 && transportCalls.length < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(transportCalls).toEqual(['/state', '/roster']);

    refresh.onConsentChanged({ decision: 'revoked', textVersion: 1 });
    // Let the pending /roster call eventually settle too (it never will on its own since nothing
    // calls releaseRoster — the abort must be what unblocks the cycle, not this).
    void releaseRoster;

    const view = await cyclePromise;

    // No further routes were requested past the two already in flight/settled when revoked.
    expect(transportCalls).toEqual(['/state', '/roster']);
    // What was already read (the /state route, which resolved before the revoke) is committed.
    expect(fidelityOf(view).account.status).toBe('resolved');
    expect(view?.payload.account).toEqual(BODIES['/state']);
    // Everything from /roster onward never completed, so it is not resolved this cycle.
    expect(fidelityOf(view).heroes.status).not.toBe('resolved');
  });

  it('drops the cached token so the next granted cycle re-reads the file', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken, callCount } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const deps = baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport: okTransport(), readToken });
    const refresh = createAccountRefresh(deps);

    await refresh.refreshNow();
    expect(callCount()).toBe(1);

    refresh.onConsentChanged({ decision: 'revoked', textVersion: 1 });

    // consentStore still reports 'granted' (revoking here only clears account-refresh's own
    // cached token; a real caller would also call consentStore.write() — T9's IPC handlers do).
    await refresh.refreshNow();

    // A second read of the token file happened — the cache was dropped on revoke, not reused.
    expect(callCount()).toBe(2);
  });

  it('a changed token file mtimeMs clears a halted gate on the next cycle, with no restart (spec edge case)', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const gate = fakeGate();
    let mtimeMs = 1000;
    const readToken = (): SessionTokenFileResult => ({
      ok: true,
      accountId: '486',
      token: SessionTokenClass.create(SENTINEL_TOKEN),
      mtimeMs,
    });
    const deps = baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport: okTransport(), readToken, gate });
    const refresh = createAccountRefresh(deps);

    // First cycle: caches mtimeMs=1000 and (in a real cycle) would proceed normally. Simulate
    // that this cycle's requests subsequently hit an unauthorized response.
    await refresh.refreshNow();
    gate.observe({ kind: 'unauthorized' });
    expect(gate.state).toBe('halted');

    // Second cycle, same mtimeMs — the cache still matches, so nothing resets the gate: it
    // stays halted, exactly as LAR-23 requires (never cleared by the normal cadence).
    await refresh.refreshNow();
    expect(gate.state).toBe('halted');

    // The token file changes on disk (e.g. the player re-logged in) — no restart, no explicit
    // retry call, just the next scheduled cycle noticing a new mtimeMs.
    mtimeMs = 2000;
    await refresh.refreshNow();

    expect(gate.state).toBe('ready');
  });
});

describe('account-refresh — the token is contained (LAR-11)', () => {
  it('writes the token to no file, no SQLite row and no IPC-shaped view', async () => {
    const open = openTestAccountDb(firstBinding());
    if (!open.db) throw new Error('expected an open db for this binding');
    const { db: recordedDb, values } = wrapWithValueRecording(open.db);
    const store = createAccountStore({ ...open, db: recordedDb });

    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const transportCalls: string[] = [];
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: okTransport(transportCalls),
      readToken,
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    for (const value of values) {
      expect(String(value)).not.toContain(SENTINEL_TOKEN);
    }
    expect(JSON.stringify(view)).not.toContain(SENTINEL_TOKEN);
  });
});

describe('account-refresh — a failed roster is served as stale with the STORED capturedAt (LAR-15)', () => {
  it('over the real AccountStore.commit(), a later failed cycle does not overwrite the earlier resolved capturedAt', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);

    let now = '2026-08-12T00:01:00.000Z';
    const cycle1Transport = okTransport();
    const deps1 = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: cycle1Transport,
      readToken,
      now: () => now,
    });
    const refresh1 = createAccountRefresh(deps1);
    const firstView = await refresh1.refreshNow();
    expect(fidelityOf(firstView).heroes).toEqual({ status: 'resolved', capturedAt: '2026-08-12T00:01:00.000Z' });

    // Second cycle: /roster now fails; every other route still resolves.
    now = '2026-08-12T00:02:00.000Z';
    const failingTransport: HttpTransport = (req) => {
      if (req.path === '/roster') {
        return Promise.resolve({ status: 500, body: 'boom' });
      }
      return Promise.resolve({ status: 200, body: JSON.stringify(BODIES[req.path] ?? {}) });
    };
    const deps2 = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: failingTransport,
      readToken,
      now: () => now,
    });
    const refresh2 = createAccountRefresh(deps2);
    const secondView = await refresh2.refreshNow();

    expect(fidelityOf(secondView).heroes).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:01:00.000Z' });
    expect(secondView?.payload.heroes).toEqual(BODIES['/roster']?.heroes);
  });
});
