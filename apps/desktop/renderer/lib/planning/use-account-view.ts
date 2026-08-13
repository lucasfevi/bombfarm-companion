/**
 * The **only** `bfc.invoke('account:get')` call site (design.md §1, §7.1). `useAccountView()` is
 * one `useState` + one `useEffect` invoking `account:get` once on mount — F2's scope is "reads
 * the account once on mount"; F3 owns re-reads and pushes over this seam without touching a
 * component.
 */
import { useEffect, useState } from 'react';
import type { AccountView } from '@bombfarm/contracts';

type Bridge = NonNullable<Window['bfc']>;

export type AccountViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'bridge-unavailable' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'loaded'; readonly view: AccountView };

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
  const [state, setState] = useState<AccountViewState>({ status: 'loading' });

  useEffect(() => {
    const bridge = (window as unknown as { bfc?: Bridge }).bfc;
    if (!bridge) {
      // Never throw — the existing "Preload bridge unavailable" empty state renders from this.
      setState({ status: 'bridge-unavailable' });
      return;
    }

    let cancelled = false;
    const loader = createAccountViewLoader(bridge);
    loader
      .load()
      .then((view) => {
        if (!cancelled) setState({ status: 'loaded', view });
      })
      .catch((err: unknown) => {
        // Surface the failure — never an all-zero account, never an empty roster presented as
        // truth (spec.md edge case).
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
