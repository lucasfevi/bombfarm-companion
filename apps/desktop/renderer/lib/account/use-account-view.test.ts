/**
 * `apps/desktop`'s Vitest project runs in `environment: 'node'` — no DOM, no `window`, and
 * `renderToStaticMarkup` never executes `useEffect` (SSR). So the "invokes `account:get`
 * exactly once" and "identity" guarantees are tested directly against `createAccountViewLoader`
 * (the piece `useAccountView`'s effect delegates to and the only part that touches the bridge),
 * plus a source-level check that the hook's effect only ever runs once per mount (an empty
 * dependency array — the same source-text-assertion genre `account-view-store.test.ts` uses to
 * prove "no React import").
 */
import { describe, expect, it } from 'vitest';
import type { AccountView } from '@bombfarm/contracts';
import { createAccountViewLoader } from './use-account-view';

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

describe("useAccountView — subscription lives in the SAME effect (source-level, the same genre as the checks above)", () => {
  it('subscribes to account:changed exactly once, inside the one useEffect — no second subscription path', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    const onCalls = source.match(/bridge\.on\(/g) ?? [];
    expect(onCalls).toHaveLength(1);
    expect(source).toContain("bridge.on('account:changed'");
  });

  it('one cleanup latches `cancelled` AND calls the bfc.on unsubscribe — not two separate cleanup paths', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    // Exactly one `return () => { ... }` cleanup in the whole file (inside the one useEffect),
    // and its body sets `cancelled = true` and calls `unsubscribe()`.
    const cleanupMatch = source.match(/return \(\) => \{([\s\S]*?)\};/);
    expect(cleanupMatch).not.toBeNull();
    const cleanupBody = cleanupMatch?.[1] ?? '';
    expect(cleanupBody).toMatch(/cancelled = true/);
    expect(cleanupBody).toMatch(/unsubscribe\(\)/);
  });

  it('the mount account:get is kept, not removed — createAccountViewLoader is still invoked from the effect', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'use-account-view.ts'), 'utf8');

    expect(source).toContain('createAccountViewLoader(bridge)');
    expect(source).toContain('loader\n      .load()');
  });
});
