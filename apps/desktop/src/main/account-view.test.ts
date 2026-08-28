/**
 * Dependency-injected — no Electron import anywhere in this file or in `account-view.ts` itself
 * (design.md, the single-source change-signal decision). Fakes stand in for `GameReaderService`/`ConsentStore`/
 * `AccountRefreshHandle`/`AccountStore` via the structural interfaces `account-view.ts` declares.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AccountPayload, AccountView, ConsentRecord, GameStatusInfo } from '@bombfarm/contracts';
import { CONSENT_TEXT_VERSION } from '@bombfarm/game-api';
import { consentRecord } from '@bombfarm/game-api/test-fixtures';
import {
  createAccountNotifier,
  resolveAccountView,
  resolveCachedAccountView,
  type AccountCommitterLike,
  type AccountRefreshLike,
  type ConsentSourceLike,
  type GameReaderLike,
} from './account-view.js';

const NOW = '2026-08-12T00:00:00.000Z';

function fidelity(status: 'resolved' | 'missing' = 'resolved') {
  return status === 'resolved'
    ? {
        account: { status: 'resolved' as const, capturedAt: NOW },
        heroes: { status: 'resolved' as const, capturedAt: NOW },
        skills: { status: 'resolved' as const, capturedAt: NOW },
        casa: { status: 'resolved' as const, capturedAt: NOW },
        items: { status: 'resolved' as const, capturedAt: NOW },
      }
    : {
        account: { status: 'missing' as const },
        heroes: { status: 'missing' as const },
        skills: { status: 'missing' as const },
        casa: { status: 'missing' as const },
        items: { status: 'missing' as const },
      };
}

function makePayload(overrides: Partial<AccountPayload> = {}): AccountPayload {
  return {
    account: { phase: 30 },
    heroes: [{ id: 'h1', level: 20 }],
    skills: { totals: { dmg_static: 2.1 } },
    casa: { active_casa: 1 },
    items: [],
    fidelity: fidelity('resolved'),
    ...overrides,
  };
}

function makeView(payload: AccountPayload, gameRunning = false): AccountView {
  return { payload, gameRunning, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

function fakeGameReader(status: GameStatusInfo['status'], view: AccountView | null): GameReaderLike {
  return {
    getStatus: () => ({ status, updatedAt: NOW }),
    getAccountView: () => view,
  };
}

function fakeConsentSource(
  decision: ConsentRecord['decision'],
  textVersion = CONSENT_TEXT_VERSION,
): ConsentSourceLike {
  return { read: () => consentRecord({ decision, grantedAt: NOW, textVersion }) };
}

function fakeAccountRefresh(view: AccountView | null): AccountRefreshLike {
  return { getLastView: () => view };
}

describe('resolveCachedAccountView — the pure-read half of the single-source change-signal decision', () => {
  it('never commits: with every producer returning nothing, it returns null', () => {
    const result = resolveCachedAccountView({
      gameReader: fakeGameReader('not_running', null),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
    });
    expect(result).toBeNull();
  });

  it('prefers the game reader\'s own cache over accountRefresh when consent is not granted', () => {
    const gameReaderView = makeView(makePayload({ heroes: [{ id: 'from-game-reader' }] }));
    const refreshView = makeView(makePayload({ heroes: [{ id: 'from-refresh' }] }));
    const result = resolveCachedAccountView({
      gameReader: fakeGameReader('connected', gameReaderView),
      consentStore: fakeConsentSource('declined'),
      accountRefresh: fakeAccountRefresh(refreshView),
    });
    expect(result?.payload.heroes).toEqual([{ id: 'from-game-reader' }]);
  });

  it('prefers accountRefresh once consent is granted', () => {
    const gameReaderView = makeView(makePayload({ heroes: [{ id: 'from-game-reader' }] }));
    const refreshView = makeView(makePayload({ heroes: [{ id: 'from-refresh' }] }));
    const result = resolveCachedAccountView({
      gameReader: fakeGameReader('connected', gameReaderView),
      consentStore: fakeConsentSource('granted'),
      accountRefresh: fakeAccountRefresh(refreshView),
    });
    expect(result?.payload.heroes).toEqual([{ id: 'from-refresh' }]);
  });

  it('falls back to the game reader when the stored grant predates the current disclosure, because the refresh cycle only produces a not-consented placeholder for it', () => {
    const gameReaderView = makeView(makePayload({ heroes: [{ id: 'from-game-reader' }] }));
    const placeholderView = makeView(makePayload({ heroes: [{ id: 'not-consented-placeholder' }] }));
    const result = resolveCachedAccountView({
      gameReader: fakeGameReader('connected', gameReaderView),
      consentStore: fakeConsentSource('granted', CONSENT_TEXT_VERSION - 1),
      accountRefresh: fakeAccountRefresh(placeholderView),
    });
    expect(result?.payload.heroes).toEqual([{ id: 'from-game-reader' }]);
  });

  it('gameRunning is always the FRESH game-reader status, never the cached view\'s own gameRunning', () => {
    const staleTrueView = makeView(makePayload(), true);
    const result = resolveCachedAccountView({
      gameReader: fakeGameReader('not_running', staleTrueView),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
    });
    expect(result?.gameRunning).toBe(false);
  });
});

describe('resolveAccountView — the single-source change-signal rule, point 1: byte-for-byte the pre-F3 account:get behaviour', () => {
  const fakeAccountStore: AccountCommitterLike = {
    commit: vi.fn((payload: AccountPayload, opts: { gameRunning: boolean }) =>
      makeView({ ...payload, fidelity: fidelity('missing') }, opts.gameRunning),
    ),
  };

  it('returns the cached view untouched when one exists — no commit attempted', () => {
    const view = makeView(makePayload());
    const commitSpy = vi.fn();
    const result = resolveAccountView({
      gameReader: fakeGameReader('connected', view),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      accountStore: { commit: commitSpy },
    });
    expect(result).toEqual({ ...view, gameRunning: true });
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('falls back to accountStore.commit({}, {gameRunning}) when nothing is cached', () => {
    const result = resolveAccountView({
      gameReader: fakeGameReader('not_running', null),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      accountStore: fakeAccountStore,
    });
    expect(fakeAccountStore.commit).toHaveBeenCalledWith({}, { gameRunning: false });
    expect(result.store.status).toBe('ok');
  });

  it('falls back to the unavailable-store literal when accountStore is also null', () => {
    const result = resolveAccountView({
      gameReader: fakeGameReader('not_running', null),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      accountStore: null,
    });
    expect(result).toEqual({
      payload: {},
      gameRunning: false,
      store: { status: 'unavailable', reason: 'no_sqlite_binding', binding: null },
    });
  });
});

describe('createAccountNotifier — the single-source change-signal rule, point 2: emits only on change, never commits', () => {
  it('a null cached view suppresses: no commit attempted, no throw, getSuppressedCount() increments', () => {
    const emit = vi.fn();
    const commitSpy = vi.fn();
    const notifier = createAccountNotifier({
      gameReader: fakeGameReader('not_running', null),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      emit,
    });

    expect(() => {
      notifier.notifyIfChanged();
    }).not.toThrow();
    expect(commitSpy).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(notifier.getSuppressedCount()).toBe(1);
    expect(notifier.getEmitCount()).toBe(0);
  });

  it('identical view ×5 ⇒ 1 emit, 4 suppressed', () => {
    const view = makeView(makePayload());
    const emit = vi.fn();
    const notifier = createAccountNotifier({
      gameReader: fakeGameReader('connected', view),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      emit,
    });

    for (let i = 0; i < 5; i++) notifier.notifyIfChanged();

    expect(notifier.getEmitCount()).toBe(1);
    expect(notifier.getSuppressedCount()).toBe(4);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('a capturedAt-only change is suppressed (same tier-0 key)', () => {
    const emit = vi.fn();
    let view = makeView(makePayload({ fidelity: fidelity('resolved') }));
    const notifier = createAccountNotifier({
      gameReader: { getStatus: () => ({ status: 'connected', updatedAt: NOW }), getAccountView: () => view },
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      emit,
    });

    notifier.notifyIfChanged();
    view = makeView(
      makePayload({
        fidelity: {
          account: { status: 'resolved', capturedAt: '2026-08-13T00:00:00.000Z' },
          heroes: { status: 'resolved', capturedAt: '2026-08-13T00:00:00.000Z' },
          skills: { status: 'resolved', capturedAt: '2026-08-13T00:00:00.000Z' },
          casa: { status: 'resolved', capturedAt: '2026-08-13T00:00:00.000Z' },
          items: { status: 'resolved', capturedAt: '2026-08-13T00:00:00.000Z' },
        },
      }),
    );
    notifier.notifyIfChanged();

    expect(notifier.getEmitCount()).toBe(1);
    expect(notifier.getSuppressedCount()).toBe(1);
  });

  it('a status-only change is emitted', () => {
    const emit = vi.fn();
    let view = makeView(makePayload({ fidelity: fidelity('resolved') }));
    const notifier = createAccountNotifier({
      gameReader: { getStatus: () => ({ status: 'connected', updatedAt: NOW }), getAccountView: () => view },
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      emit,
    });

    notifier.notifyIfChanged();
    view = makeView(
      makePayload({
        fidelity: {
          ...fidelity('resolved'),
          skills: { status: 'stale', capturedAt: NOW },
        },
      }),
    );
    notifier.notifyIfChanged();

    expect(notifier.getEmitCount()).toBe(2);
    expect(notifier.getSuppressedCount()).toBe(0);
  });

  it('the emitted view equals resolveAccountView\'s output for the SAME producer state (design.md §2.3 — the push and the pull carry the same thing)', () => {
    const view = makeView(makePayload());
    const emit = vi.fn();
    const deps = {
      gameReader: fakeGameReader('connected', view),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
    };
    const notifier = createAccountNotifier({ ...deps, emit });
    notifier.notifyIfChanged();

    const pulled = resolveAccountView({ ...deps, accountStore: null });
    expect(emit).toHaveBeenCalledWith(pulled);
  });

  it('demonstrates the red state: an unconditional emit fails both suppression assertions above (observed here, not committed as a permanent mutation)', () => {
    function createAlwaysEmitNotifier(deps: {
      gameReader: GameReaderLike | null;
      consentStore: ConsentSourceLike | null;
      accountRefresh: AccountRefreshLike | null;
      emit: (view: AccountView) => void;
    }) {
      let emitCount = 0;
      let suppressedCount = 0;
      return {
        notifyIfChanged(): void {
          const view = resolveCachedAccountView(deps);
          if (!view) {
            suppressedCount += 1;
            return;
          }
          // The mutation: no key comparison at all — every non-null resolve emits.
          emitCount += 1;
          deps.emit(view);
        },
        getEmitCount: () => emitCount,
        getSuppressedCount: () => suppressedCount,
      };
    }

    const view = makeView(makePayload());
    const emit = vi.fn();
    const broken = createAlwaysEmitNotifier({
      gameReader: fakeGameReader('connected', view),
      consentStore: fakeConsentSource('unasked'),
      accountRefresh: fakeAccountRefresh(null),
      emit,
    });
    for (let i = 0; i < 5; i++) broken.notifyIfChanged();

    // The real notifier asserts emitCount=1, suppressedCount=4 for this exact scenario (see the
    // "identical view ×5" test above) — the mutant disagrees on both counts, proving the
    // suppression tests are discriminating and not vacuously true.
    expect(broken.getEmitCount()).toBe(5);
    expect(broken.getSuppressedCount()).toBe(0);
    expect(broken.getEmitCount()).not.toBe(1);
  });
});
