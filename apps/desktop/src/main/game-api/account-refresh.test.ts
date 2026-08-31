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
import { CONSENT_TEXT_VERSION, SessionToken as SessionTokenClass, createPacingGate } from '@bombfarm/game-api';
import { consentRecord, grantedConsent } from '@bombfarm/game-api/test-fixtures';
import type { AccountStore } from '../storage/account-store.js';
import { createAccountStore } from '../storage/account-store.js';
import type { SqliteBinding, SqliteDb, SqliteStatement } from '../storage/index.js';
import {
  createLogSpy,
  detectAvailableBindings,
  openTestAccountDb,
  warnForUnavailableBindings,
} from '../storage/test-support.js';
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

const GRANTED = grantedConsent('2026-08-12T13:15:38.000Z');
const DECLINED = consentRecord({ decision: 'declined' });
const UNASKED = consentRecord({ decision: 'unasked' });

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

/** A schema-conforming `/roster` hero — `ROUTE_FINGERPRINTS.heroes`'s `hero` level (T5).
 *  These bodies predate T5's deepened, exact-key fingerprints; a missing key now makes
 *  `checkShape` mark the whole route `drift` instead of `resolved`, which this test suite reads
 *  through `fidelityOf(...).status`. */
function fullHero(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1',
    name: 'Nyx',
    level: 1,
    xp: 0,
    rarity: 1,
    rank: 1,
    stars: 0,
    skin: 0,
    skin_birth: 0,
    in_field: true,
    battle_allowed: true,
    marketable: false,
    in_market: false,
    slots: {},
    stats: {},
    birth_stats: {},
    stat_ranges: {},
    abilities: {},
    ability_points_total: 0,
    ability_points_spent: 0,
    ability_reroll_cost: 0,
    ability_reroll_stone: 0,
    stat_points_available: 0,
    ...overrides,
  };
}

const BODIES: Record<string, Record<string, unknown>> = {
  '/state': {
    gold: 100,
    crystals: 0,
    phase: 5,
    max_phase: 10,
    locked: false,
    checkpoint_at: '2026-08-01T00:00:00.000Z',
    chests: [],
    chest_stash: [],
    item_stash: [],
    vip_until: 0,
    bag_tabs: 4,
    bag_capacity: 100,
    items_count: 2,
  },
  '/roster': { heroes: [fullHero()] },
  '/skill/state': {
    levels: {},
    refunds: {},
    field_slots: 3,
    bag_tabs: 4,
    gold: 100,
    max_phase: 10,
    totals: {
      team_dmg_add: 1,
      crit_chance_add: 1,
      crit_dmg_add: 1,
      speed_add: 1,
      coin_add: 1,
      luck_add: 1,
      energia_add: 1,
      xp_mult: 1,
      geo_mult: 1,
      dmg_static: 1,
      vagas_campo: 1,
      bag_tabs_bonus: 1,
    },
  },
  '/rotation': {
    field_size: 9,
    rescues_left: 0,
    rescues_max: 0,
    heroes: [
      {
        id: '1',
        level: 1,
        energia_atual: 0,
        energia_max: 0,
        energia_pct: 0,
        state: 'idle',
        in_field: false,
        in_casa: true,
        recovering: false,
        battle_allowed: true,
      },
    ],
    casa: {
      active_casa: 1,
      levels: [1],
      cycle_secs: [1],
      slots: 1,
      slots_per_house: [1],
      cycle_secs_per_house: [1],
      upgrade_cost: [1],
    },
  },
  '/inventory': {
    items: [
      {
        id: '1',
        def_id: 'd1',
        set: 'set1',
        rarity: 1,
        category: 1,
        level: 1,
        stats: [],
        power: 0,
        sell_value: 0,
        sellable: true,
        upgrade: 0,
        tradable: true,
        market_state: 0,
        locked: false,
        equipped_on: null,
        equip_slot: null,
        in_stash: true,
      },
    ],
    chests: [],
    bag_tabs: 4,
    bag_capacity: 100,
    items_count: 1,
  },
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
    isGameRunning: () => true,
    ...overrides,
  };
}

describe('account-refresh — unasked consent', () => {
  it('ran against at least one SQLite binding', () => {
    expect(AVAILABLE_BINDINGS.length).toBeGreaterThan(0);
  });

  it('issues zero transport calls, zero FsPort/readToken calls, and commits nothing', async () => {
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
    // Every section came back `failed('not_consented')` — a read that found nothing is not
    // evidence the data is gone, so the cycle commits nothing at all.
    expect(view).toBeNull();
    expect(refresh.getLastView()).toBeNull();
  });
});

describe('account-refresh — a grant that predates the current disclosure', () => {
  it('issues zero transport calls and commits nothing, exactly as an unanswered first run does', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore({ ...GRANTED, textVersion: CONSENT_TEXT_VERSION - 1 }),
      transport: (req) => {
        transportCalls.push(req.path);
        return Promise.reject(new Error('transport must never be called under a superseded grant'));
      },
      readToken: throwingReadToken(),
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(transportCalls).toEqual([]);
    expect(view).toBeNull();
  });
});

describe('account-refresh — declined consent', () => {
  it('issues zero requests and commits nothing', async () => {
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

    expect(view).toBeNull();
    expect(refresh.getLastView()).toBeNull();
  });

  it('does not overwrite a resolved section another producer already committed to the same store', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);

    // Stand-in for the game reader: a granted cycle over the same store resolves and commits
    // real data first.
    const grantedRefresh = createAccountRefresh(
      baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport: okTransport(), readToken }),
    );
    const firstView = await grantedRefresh.refreshNow();
    expect(fidelityOf(firstView).account.status).toBe('resolved');
    const beforeSecondCycle = store.restore();

    // A later cycle under declined consent must leave that data exactly as it was.
    const declinedRefresh = createAccountRefresh(
      baseDeps({
        store,
        consentStore: fixedConsentStore(DECLINED),
        transport: throwingTransport(),
        readToken: throwingReadToken(),
      }),
    );
    const secondView = await declinedRefresh.refreshNow();

    expect(secondView).toBeNull();
    expect(store.restore()).toEqual(beforeSecondCycle);
  });
});

describe('account-refresh — session token unavailable', () => {
  it('issues zero requests and commits nothing', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: throwingTransport(),
      readToken: () => ({ ok: false, reason: 'not_found' }),
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(view).toBeNull();
    expect(refresh.getLastView()).toBeNull();
  });

  it('does not overwrite a resolved section another producer already committed to the same store', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);

    const grantedRefresh = createAccountRefresh(
      baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport: okTransport(), readToken }),
    );
    const firstView = await grantedRefresh.refreshNow();
    expect(fidelityOf(firstView).account.status).toBe('resolved');
    const beforeSecondCycle = store.restore();

    // A later cycle that cannot read the session token file must leave that data exactly as it
    // was, rather than degrading it with an all-missing placeholder.
    const strandedRefresh = createAccountRefresh(
      baseDeps({
        store,
        consentStore: fixedConsentStore(GRANTED),
        transport: throwingTransport(),
        readToken: () => ({ ok: false, reason: 'not_found' }),
      }),
    );
    const secondView = await strandedRefresh.refreshNow();

    expect(secondView).toBeNull();
    expect(store.restore()).toEqual(beforeSecondCycle);
  });
});

describe('account-refresh — game not running', () => {
  it('issues zero transport calls when the game is not running, even with consent and a readable token', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: (req) => {
        transportCalls.push(req.path);
        return Promise.reject(new Error('transport must never be called while the game is not running'));
      },
      readToken,
      isGameRunning: () => false,
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(transportCalls).toHaveLength(0);
    expect(view).toBeNull();
    expect(refresh.getLastView()).toBeNull();
  });

  it('does not read the token at all when the game is not running', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: throwingTransport(),
      readToken: throwingReadToken(),
      isGameRunning: () => false,
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(view).toBeNull();
  });

  it('issues requests once the game is running (consent granted, token readable)', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: okTransport(transportCalls),
      readToken,
      isGameRunning: () => true,
    });
    const refresh = createAccountRefresh(deps);

    await refresh.refreshNow();

    expect(transportCalls.length).toBeGreaterThan(0);
  });

  it('does not overwrite a resolved section another producer already committed to the same store', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);

    const grantedRefresh = createAccountRefresh(
      baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport: okTransport(), readToken }),
    );
    const firstView = await grantedRefresh.refreshNow();
    expect(fidelityOf(firstView).account.status).toBe('resolved');
    const beforeSecondCycle = store.restore();

    const notRunningRefresh = createAccountRefresh(
      baseDeps({
        store,
        consentStore: fixedConsentStore(GRANTED),
        transport: throwingTransport(),
        readToken,
        isGameRunning: () => false,
      }),
    );
    const secondView = await notRunningRefresh.refreshNow();

    expect(secondView).toBeNull();
    expect(store.restore()).toEqual(beforeSecondCycle);
  });

  it.each([true, false])(
    'declined consent still skips with zero transport calls regardless of whether the game is running (isGameRunning=%s)',
    async (isGameRunning) => {
      const open = openTestAccountDb(firstBinding());
      const store = createAccountStore(open);
      const transportCalls: string[] = [];
      const { log, records } = createLogSpy();
      const deps = baseDeps({
        store,
        consentStore: fixedConsentStore(DECLINED),
        transport: (req) => {
          transportCalls.push(req.path);
          return Promise.reject(new Error('transport must never be called while consent is declined'));
        },
        readToken: throwingReadToken(),
        isGameRunning: () => isGameRunning,
        log,
      });
      const refresh = createAccountRefresh(deps);

      const view = await refresh.refreshNow();

      expect(transportCalls).toHaveLength(0);
      expect(view).toBeNull();
      const skip = records.find((r) => r.record.event === 'cycle.skipped');
      expect(skip?.record.decision).toBe('declined');
    },
  );

  it('the game-not-running skip logs a record distinguishable from both the not-consented and token-unavailable skips', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);

    const notConsentedLog = createLogSpy();
    await createAccountRefresh(
      baseDeps({
        store,
        consentStore: fixedConsentStore(UNASKED),
        transport: throwingTransport(),
        readToken: throwingReadToken(),
        log: notConsentedLog.log,
      }),
    ).refreshNow();

    const gameNotRunningLog = createLogSpy();
    await createAccountRefresh(
      baseDeps({
        store,
        consentStore: fixedConsentStore(GRANTED),
        transport: throwingTransport(),
        readToken: throwingReadToken(),
        isGameRunning: () => false,
        log: gameNotRunningLog.log,
      }),
    ).refreshNow();

    const tokenUnavailableLog = createLogSpy();
    await createAccountRefresh(
      baseDeps({
        store,
        consentStore: fixedConsentStore(GRANTED),
        transport: throwingTransport(),
        readToken: () => ({ ok: false, reason: 'not_found' }),
        log: tokenUnavailableLog.log,
      }),
    ).refreshNow();

    const notConsentedSkip = notConsentedLog.records.find((r) => r.record.event === 'cycle.skipped');
    const gameNotRunningSkip = gameNotRunningLog.records.find((r) => r.record.event === 'cycle.skipped');
    const tokenUnavailableSkip = tokenUnavailableLog.records.find((r) => r.record.event === 'token.unavailable');

    expect(notConsentedSkip).toBeDefined();
    expect(gameNotRunningSkip).toBeDefined();
    expect(tokenUnavailableSkip).toBeDefined();

    expect(gameNotRunningSkip?.record).not.toEqual(notConsentedSkip?.record);
    expect(gameNotRunningSkip?.record.reason).toBe('game_not_running');
    expect(notConsentedSkip?.record.reason).not.toBe('game_not_running');
    expect(gameNotRunningSkip?.record.event).not.toBe(tokenUnavailableSkip?.record.event);
  });

  it('resumes issuing requests on the next cycle once the game is running again, with no restart', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const transportCalls: string[] = [];
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    let gameRunning = false;
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport: okTransport(transportCalls),
      readToken,
      isGameRunning: () => gameRunning,
    });
    const refresh = createAccountRefresh(deps);

    const firstView = await refresh.refreshNow();
    expect(transportCalls).toHaveLength(0);
    expect(firstView).toBeNull();

    const secondView = await refresh.refreshNow();
    expect(transportCalls).toHaveLength(0);
    expect(secondView).toBeNull();

    gameRunning = true;
    const thirdView = await refresh.refreshNow();

    expect(transportCalls.length).toBeGreaterThan(0);
    expect(fidelityOf(thirdView).account.status).toBe('resolved');
  });
});

describe('account-refresh — the game-running flag is read fresh at commit time', () => {
  it('commits gameRunning: false when the game exits partway through a cycle', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    let gameRunning = true;
    const transport: HttpTransport = (req) => {
      if (req.path === '/roster') {
        gameRunning = false;
      }
      return Promise.resolve({ status: 200, body: JSON.stringify(BODIES[req.path] ?? {}) });
    };
    const deps = baseDeps({
      store,
      consentStore: fixedConsentStore(GRANTED),
      transport,
      readToken,
      isGameRunning: () => gameRunning,
    });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(view?.gameRunning).toBe(false);
  });
});

describe('account-refresh — consent changing to granted', () => {
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

describe('account-refresh — revoke mid-cycle', () => {
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
    // stays halted, exactly as the 401/403 terminal-state rule requires (never cleared by the normal cadence).
    await refresh.refreshNow();
    expect(gate.state).toBe('halted');

    // The token file changes on disk (e.g. the player re-logged in) — no restart, no explicit
    // retry call, just the next scheduled cycle noticing a new mtimeMs.
    mtimeMs = 2000;
    await refresh.refreshNow();

    expect(gate.state).toBe('ready');
  });
});

describe('account-refresh — the token is contained', () => {
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

describe('account-refresh — a failed roster is served as stale with the STORED capturedAt', () => {
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

describe('account-refresh — a drifted section is logged with path-qualified keys and no player data', () => {
  it('a /state response missing one key and carrying one unrecognized key logs section.drift naming both, never a response value', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);
    const sentinelGold = 918273645;

    // A drifted /state body: missing the declared `crystals` key, carrying an unrecognized
    // `some_future_key` — both a missing-key and an added-key trigger in the same response, so
    // this proves the log names both lists, not just whichever `checkShape` finds first.
    const driftedState: Record<string, unknown> = { ...BODIES['/state'] };
    delete driftedState.crystals;
    driftedState.some_future_key = sentinelGold;

    const transport: HttpTransport = (req) => {
      if (req.path === '/state') {
        return Promise.resolve({ status: 200, body: JSON.stringify(driftedState) });
      }
      return Promise.resolve({ status: 200, body: JSON.stringify(BODIES[req.path] ?? {}) });
    };

    const { log, records } = createLogSpy();
    const deps = baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport, readToken, log });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    // A drifted section still reports the shape break (added keys are still fatal to the
    // fingerprint check), but `/state` projects identity, so the drifted body is still a usable
    // object — the section is served degraded, carrying its body, not discarded as missing.
    expect(fidelityOf(view).account).toEqual({
      status: 'degraded',
      capturedAt: '2026-08-12T00:01:00.000Z',
      missingKeys: ['account.crystals'],
      addedKeys: ['account.some_future_key'],
    });
    expect(view?.payload.account).toEqual(driftedState);

    const drift = records.find((r) => r.record.event === 'section.drift');
    expect(drift).toBeDefined();
    expect(drift?.record.scope).toBe('account-refresh');
    expect(drift?.record.section).toBe('account');
    expect(drift?.record.missingKeys).toContain('account.crystals');
    expect(drift?.record.addedKeys).toContain('account.some_future_key');

    // No player data anywhere in the log payload — never the sentinel value itself, only the key
    // paths that named it.
    const payload = JSON.stringify(drift?.record);
    expect(payload).not.toContain(String(sentinelGold));
  });

  it('a cycle that loses one route and commits the other four logs section.failed naming it, so a partial commit is not indistinguishable from a clean one', async () => {
    const open = openTestAccountDb(firstBinding());
    const store = createAccountStore(open);
    const { fn: readToken } = fixedReadToken('486', SessionTokenClass.create(SENTINEL_TOKEN), 1000);

    const transport: HttpTransport = (req) => {
      if (req.path === '/roster') {
        return Promise.resolve({ status: 500, body: '' });
      }
      return Promise.resolve({ status: 200, body: JSON.stringify(BODIES[req.path] ?? {}) });
    };

    const { log, records } = createLogSpy();
    const deps = baseDeps({ store, consentStore: fixedConsentStore(GRANTED), transport, readToken, log });
    const refresh = createAccountRefresh(deps);

    const view = await refresh.refreshNow();

    expect(fidelityOf(view).heroes).toEqual({ status: 'missing' });
    expect(view?.payload.casa).toBeDefined();

    const failures = records.filter((r) => r.record.event === 'section.failed');
    expect(failures.map((r) => r.record.section)).toEqual(['heroes']);
    expect(failures[0]?.record.scope).toBe('account-refresh');
    expect(failures[0]?.record.reason).toBe('http_error');
  });
});
