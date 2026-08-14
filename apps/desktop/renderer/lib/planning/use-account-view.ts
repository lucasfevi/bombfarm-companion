/**
 * The **only** `bfc.invoke('account:get')` call site (design.md §1, §7.1) — and, since MP3 F3,
 * the **only** `bfc.on('account:changed', …)` subscription site. `useAccountView()` stays one
 * `useState` + one `useEffect` (F2's own structural shape, still enforced by
 * `use-account-view.test.ts`): the effect fires the mount `account:get` (kept — see the boot-race
 * comment below) and subscribes to `account:changed`, and every arrival is folded through
 * `account-view-store.ts`'s pure `accept()` reducer via one `setState(prev => accept(prev, …))`
 * call per event. F2's scope was "reads the account once on mount"; F3 owns re-reads and pushes
 * over this same seam without touching a component.
 */
import { useEffect, useState } from 'react';
import type { AccountView } from '@bombfarm/contracts';
import { accept, initialAccountViewState } from './account-view-store';
import type { AccountViewState } from './account-view-store';

export type { AccountViewState };

type Bridge = NonNullable<Window['bfc']>;

/**
 * Wraps `bridge.invoke('account:get')` with an idempotency guard: even if `load()` is called
 * more than once against the same loader, the underlying `account:get` invoke fires exactly
 * once and every caller resolves to the same value. `apps/desktop`'s Vitest project has no DOM
 * and no effect-flushing harness (`renderToStaticMarkup` never runs `useEffect`), so this is
 * what makes the "invokes `account:get` exactly once" guarantee directly unit-testable —
 * `use-account-view.test.ts` calls `load()` multiple times against one loader and asserts the
 * mock bridge's `invoke` was called exactly once, with every resolution the same reference (the
 * IPC boundary structurally clones on each real invoke, so identity is never mutated in place).
 */
export function createAccountViewLoader(bridge: Bridge) {
  let promise: Promise<AccountView> | null = null;
  return {
    load(): Promise<AccountView> {
      promise ??= bridge.invoke('account:get');
      return promise;
    },
  };
}

export function useAccountView(): AccountViewState {
  const [state, setState] = useState<AccountViewState>(initialAccountViewState);

  useEffect(() => {
    const bridge = (window as unknown as { bfc?: Bridge }).bfc;
    if (!bridge) {
      // Never throw — the existing "Preload bridge unavailable" empty state renders from this.
      setState((prev) => accept(prev, { kind: 'bridge-missing' }));
      return;
    }

    let cancelled = false;
    const loader = createAccountViewLoader(bridge);
    // The mount fetch's `issuedAt` — always `initialAccountViewState.applied` (0), because this
    // is the ONE fetch this hook ever issues (design.md §4.4's "the mount fetch is kept, not
    // removed" — main only pushes on change, and an emit before the renderer subscribed is
    // silently dropped by `webContents.send`, which is why a mount read is still needed even
    // though main also pushes). No `state.applied` read is required here: nothing can have been
    // accepted yet at the moment this synchronous effect body issues the fetch.
    const issuedAt = initialAccountViewState.applied;

    loader
      .load()
      .then((view) => {
        if (!cancelled) setState((prev) => accept(prev, { kind: 'fetched', view, issuedAt }));
      })
      .catch((err: unknown) => {
        // Surface the failure — never an all-zero account, never an empty roster presented as
        // truth (spec.md edge case). Discarded by accept() itself if a view was already applied.
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState((prev) => accept(prev, { kind: 'fetch-failed', message, issuedAt }));
        }
      });

    // MP3 F3 — the one `account:changed` subscription site. Fires on a genuine change only
    // (`AD-043`); `accept()`'s own accept gate (tier-0 key comparison) is a second, redundant-but-
    // harmless line of defence against a no-op push. One effect, one cleanup: the `cancelled`
    // latch and the unsubscribe below both live in the SAME cleanup function (MAR-12) — there is
    // no second subscription path.
    const unsubscribe = bridge.on('account:changed', (view) => {
      if (!cancelled) setState((prev) => accept(prev, { kind: 'pushed', view }));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
