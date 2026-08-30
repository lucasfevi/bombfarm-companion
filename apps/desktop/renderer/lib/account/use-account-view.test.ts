/**
 * `apps/desktop`'s Vitest project runs in `environment: 'node'` — no DOM, and
 * `renderToStaticMarkup` never executes `useEffect` (SSR), so the hook itself cannot be rendered
 * here. What it delegates to can: `createAccountViewLoader` and `createAccountViewStore` are
 * exercised directly, the latter against a `window.bfc` this file supplies as a plain global.
 * Only what is left over — the hook's own shape — is asserted from source text, the same genre
 * `account-view-store.test.ts` uses to prove "no React import".
 */
import { describe, expect, it } from 'vitest';
import type { AccountView } from '@bombfarm/contracts';
import { createAccountViewLoader, createAccountViewStore } from './use-account-view';

function fakeAccountView(): AccountView {
  return {
    payload: { heroes: [] },
    gameRunning: false,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
}

function fakeBridge(resolveWith: AccountView) {
  let calls = 0;
  return {
    calls: () => calls,
    bridge: {
      invoke: (_channel: string) => {
        calls++;
        return Promise.resolve(resolveWith);
      },
      on: () => () => undefined,
    } as unknown as NonNullable<Window['bfc']>,
  };
}

describe('createAccountViewLoader — invokes account:get exactly once', () => {
  it('load() called three times still invokes the bridge exactly once', async () => {
    const view = fakeAccountView();
    const { bridge, calls } = fakeBridge(view);
    const loader = createAccountViewLoader(bridge);

    await loader.load();
    await loader.load();
    await loader.load();

    expect(calls()).toBe(1);
  });

  it('every resolution is the same reference — the loader never mutates or re-wraps the IPC-cloned view', async () => {
    const view = fakeAccountView();
    const { bridge } = fakeBridge(view);
    const loader = createAccountViewLoader(bridge);

    const first = await loader.load();
    const second = await loader.load();

    expect(first).toBe(view);
    expect(second).toBe(view);
    expect(first).toBe(second);
  });

  it('two independent loaders each invoke the bridge once — the guard is per-loader-instance, not global', async () => {
    const view = fakeAccountView();
    const { bridge, calls } = fakeBridge(view);
    const loaderA = createAccountViewLoader(bridge);
    const loaderB = createAccountViewLoader(bridge);

    await loaderA.load();
    await loaderB.load();

    expect(calls()).toBe(2);
  });
});

describe('useAccountView — structural guarantee that the fetch effect runs once per mount', () => {
  it('the hook declares exactly one useEffect, with an empty dependency array', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    const effectCalls = source.match(/useEffect\(/g) ?? [];
    expect(effectCalls).toHaveLength(1);

    // The effect body ends with `}, []);` — an empty dep array, so React only ever runs it once
    // per mount regardless of how many times the owning component re-renders (e.g. on selection
    // changes elsewhere in the tree).
    expect(source).toMatch(/\},\s*\[\]\);/);
  });

  it('the hook is a single useState + the one useEffect above — no other state', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    const stateCalls = source.match(/useState[<(]/g) ?? [];
    expect(stateCalls).toHaveLength(1);
  });
});

describe('useAccountView — subscription lives in the store, not the mount (source-level, the same genre as the checks above)', () => {
  it('subscribes to account:changed exactly once — no second subscription path', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    const onCalls = source.match(/bridge\.on\(/g) ?? [];
    expect(onCalls).toHaveLength(1);
    expect(source).toContain("bridge.on('account:changed'");
  });

  it('the boot account:get is kept, not removed — createAccountViewLoader is still invoked', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    expect(source).toContain('createAccountViewLoader(bridge)');
    expect(source).toMatch(/loader\s*\.load\(\)/);
  });

  it('the effect cleanup only unsubscribes this mount — it never tears the store down', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    expect(source).toContain('return unsubscribe;');
    expect(source).toContain('createLazySingleton(createAccountViewStore)');
    expect(source).not.toMatch(/useEffect\(\(\) => \{[\s\S]*createAccountViewStore\(/);
  });

  it('seeds the very first render from the store, so a remount never paints a loading frame', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    expect(source).toContain('useState<AccountViewState>(() => sharedAccountViewStore().getState())');
  });
});

/**
 * The store is testable where the hook is not: `connect` reads `window.bfc`, which this
 * node-environment project can supply as a plain global, so the arrival wiring runs for real
 * instead of being asserted from its source text.
 */
describe('createAccountViewStore', () => {
  function withBridge(bridge: unknown, run: () => void | Promise<void>) {
    const globals = globalThis as { window?: unknown };
    const had = 'window' in globals;
    const previous = globals.window;
    globals.window = { bfc: bridge };
    try {
      return run();
    } finally {
      if (had) globals.window = previous;
      else delete globals.window;
    }
  }

  it('reports bridge-unavailable rather than throwing when there is no preload bridge', () => {
    void withBridge(undefined, () => {
      const store = createAccountViewStore();

      store.start();

      expect(store.getState().status).toBe('bridge-unavailable');
    });
  });

  it('reads account:get exactly once however many times it is started', async () => {
    const { bridge, calls } = fakeBridge(fakeAccountView());

    await withBridge(bridge, async () => {
      const store = createAccountViewStore();

      store.start();
      store.start();
      await Promise.resolve();

      expect(calls()).toBe(1);
      expect(store.getState().status).toBe('loaded');
    });
  });

  it('keeps applying pushes while nothing is subscribed, and the next subscriber sees them', async () => {
    let push: ((view: AccountView) => void) | null = null;
    const bridge = {
      invoke: () => Promise.resolve(fakeAccountView()),
      on: (_channel: string, listener: (view: AccountView) => void) => {
        push = listener;
        return () => undefined;
      },
    } as unknown as NonNullable<Window['bfc']>;

    await withBridge(bridge, async () => {
      const store = createAccountViewStore();
      store.start();
      await Promise.resolve();

      // Every subscriber has gone — the Inventory tab is unmounted and some other tab is showing.
      const unsubscribe = store.subscribe(() => {});
      unsubscribe();
      push?.({ ...fakeAccountView(), payload: { heroes: [{ id: 'h1' }] } });

      const state = store.getState();
      expect(state.status).toBe('loaded');
      expect(state.status === 'loaded' ? state.applied : 0).toBe(2);
    });
  });
});
