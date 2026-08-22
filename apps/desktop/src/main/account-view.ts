/**
 * `AD-043` — the single resolved source both `account:get` and `account:changed` speak from.
 * Flat under `src/main/`, alongside `domain-edge.ts`/`boot-record.ts` (the same convention).
 * Imports **no Electron module** and takes every producer by structural injection, so this is
 * unit-testable without launching an app.
 */
import { accountChangeKey } from '@bombfarm/contracts';
import type { AccountPayload, AccountView, ConsentRecord, GameStatusInfo } from '@bombfarm/contracts';

/**
 * The subset of `GameReaderService` this module reads — structural, not imported, so this
 * module pulls in no Electron-touching code (`GameReaderService` imports `electron`'s
 * `BrowserWindow` type and, transitively, the native memory-scanning modules).
 */
export interface GameReaderLike {
  getStatus(): GameStatusInfo;
  getAccountView(): AccountView | null;
}

export interface ConsentSourceLike {
  read(): ConsentRecord;
}

export interface AccountRefreshLike {
  getLastView(): AccountView | null;
}

export interface AccountCommitterLike {
  // A property (arrow-function type), not a method-shorthand signature — so a test double
  // assigned here can be safely referenced as a value (e.g. `expect(fake.commit).toHaveBeenCalledWith(...)`)
  // without `@typescript-eslint/unbound-method` treating it as a `this`-bound method access.
  commit: (payload: AccountPayload, opts: { gameRunning: boolean }) => AccountView;
}

export interface AccountViewDeps {
  gameReader: GameReaderLike | null;
  consentStore: ConsentSourceLike | null;
  accountRefresh: AccountRefreshLike | null;
}

export interface ResolveAccountViewDeps extends AccountViewDeps {
  accountStore: AccountCommitterLike | null;
}

/**
 * Pure read — the verbatim body of `index.ts`'s pre-F3 `account:get` handler (`index.ts:77-98`),
 * split at the point a fallback commit would otherwise happen. **No commit, no SQLite, no
 * throw.** Safe to call from the commit path itself, which is exactly what the notifier does
 * (`AD-043` point 2) — this is the half of the split that keeps the notifier from ever reaching
 * a database that `before-quit` may have already closed (the fixture-tick-after-db-close crash
 * fixed in PR #69, `2dcfb73`).
 */
export function resolveCachedAccountView(deps: AccountViewDeps): AccountView | null {
  // gameRunning always comes fresh from the game reader's current status — never from a
  // cached view, so a stale cached commit can never misreport whether the game is running.
  const gameRunning = deps.gameReader?.getStatus().status === 'connected';
  // The game-API cycle (MP2 F2) is the freshest live producer, but only once it has
  // actually read something — i.e. once consent is granted. Before that, every cycle it
  // runs (including the very first one at boot, and every one thereafter while declined/
  // unasked/revoked) commits nothing but an all-`missing` "not consented" placeholder
  // through the *same* AccountStore the fixture/memory game reader writes to
  // (`AccountStore.commit()` = persist+restore+merge). Preferring that placeholder
  // unconditionally — as this used to do — meant one no-op cycle at boot permanently
  // masked the game reader's own resolved fixture/memory data behind a `stale` merge for
  // the 60s until the game-API cycle's next run (T-fix-6, caught by
  // `account-restart.spec.mjs`). So: the game reader's own cache wins whenever it has one
  // (real production's live-tap reader never populates it — see
  // `GameReaderService.tickLive()` — so this changes nothing there); only once consent
  // is granted does the game-API cycle's own (now genuinely fresher) view get first look.
  const consentGranted = deps.consentStore?.read().decision === 'granted';
  const cached =
    (consentGranted ? deps.accountRefresh?.getLastView() : null) ??
    deps.gameReader?.getAccountView() ??
    deps.accountRefresh?.getLastView();
  if (cached) {
    return { ...cached, gameRunning };
  }
  return null;
}

/**
 * `resolveCachedAccountView(deps)` else `accountStore.commit({}, {gameRunning})` else the
 * unavailable-store literal — `account:get`'s full pre-F3 behaviour, unchanged
 * (`AD-043` point 1). `index.ts`'s handler becomes a one-line call to this.
 */
export function resolveAccountView(deps: ResolveAccountViewDeps): AccountView {
  const cached = resolveCachedAccountView(deps);
  if (cached) return cached;
  const gameRunning = deps.gameReader?.getStatus().status === 'connected';
  return (
    deps.accountStore?.commit({}, { gameRunning }) ?? {
      payload: {},
      gameRunning,
      store: { status: 'unavailable', reason: 'no_sqlite_binding', binding: null },
    }
  );
}

export interface AccountNotifierDeps extends AccountViewDeps {
  emit(view: AccountView): void;
}

export interface AccountNotifier {
  notifyIfChanged(): void;
  getEmitCount(): number;
  getSuppressedCount(): number;
}

/**
 * `AD-043` point 2 — the gate that makes `account:changed` a true change signal. Calls
 * **`resolveCachedAccountView` only**, never the committing form, so this can run on the commit
 * path (up to 20×/s in fixture mode, and during `before-quit`) without ever being able to write
 * to SQLite or reach a store `before-quit` has already closed. A `null` cached view suppresses:
 * there is nothing to notify about.
 */
export function createAccountNotifier(deps: AccountNotifierDeps): AccountNotifier {
  let lastKey: string | null = null;
  let emitCount = 0;
  let suppressedCount = 0;

  return {
    notifyIfChanged(): void {
      const view = resolveCachedAccountView(deps);
      if (!view) {
        suppressedCount += 1;
        return;
      }
      const key = accountChangeKey(view.payload);
      if (key === lastKey) {
        suppressedCount += 1;
        return;
      }
      lastKey = key;
      emitCount += 1;
      deps.emit(view);
    },
    getEmitCount(): number {
      return emitCount;
    },
    getSuppressedCount(): number {
      return suppressedCount;
    },
  };
}
