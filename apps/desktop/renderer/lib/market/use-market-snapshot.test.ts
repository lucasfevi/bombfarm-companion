import { describe, expect, it, vi } from 'vitest';
import type { MarketQuoteResult } from '@bombfarm/contracts';
import { createMarketSnapshotStore, createQuoteRefresher } from './use-market-snapshot';

type Bridge = NonNullable<Window['bfc']>;

const quoted = (amount: number): MarketQuoteResult => ({
  ok: true,
  key: 'k1',
  hashName: 'Gold Gloves (Legendary)',
  currency: 'BRL',
  amount,
  quotedUtc: '2026-08-29T12:00:00.000Z',
});

/** A bridge whose every invoke stays pending until the test settles it by call order. */
function deferredBridge(): {
  bridge: Bridge;
  invoke: ReturnType<typeof vi.fn>;
  settle: (index: number, amount: number) => void;
} {
  const pending: ((result: MarketQuoteResult) => void)[] = [];
  const invoke = vi.fn(
    () =>
      new Promise<MarketQuoteResult>((resolve) => {
        pending.push(resolve);
      }),
  );
  return {
    bridge: { invoke, on: () => () => undefined } as unknown as Bridge,
    invoke,
    settle: (index, amount) => pending[index]?.(quoted(amount)),
  };
}

describe('createQuoteRefresher', () => {
  it('coalesces concurrent refreshes of the same item into one call', async () => {
    const { bridge, invoke, settle } = deferredBridge();
    const refresher = createQuoteRefresher(bridge);

    const first = refresher.refresh({ kind: 'key', key: 'k1' });
    const second = refresher.refresh({ kind: 'key', key: 'k1' });
    settle(0, 31.5);

    expect(await first).toEqual(await second);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('market:refreshItem', { kind: 'key', key: 'k1' });
  });

  it('issues a second call once the first has settled, so a later refresh is never suppressed', async () => {
    const { bridge, invoke, settle } = deferredBridge();
    const refresher = createQuoteRefresher(bridge);

    const first = refresher.refresh({ kind: 'key', key: 'k1' });
    settle(0, 31.5);
    await first;

    const second = refresher.refresh({ kind: 'key', key: 'k1' });
    settle(1, 30);

    expect(await second).toMatchObject({ amount: 30 });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('does not coalesce two different items', async () => {
    const { bridge, invoke, settle } = deferredBridge();
    const refresher = createQuoteRefresher(bridge);

    const byKey = refresher.refresh({ kind: 'key', key: 'k1' });
    const byHash = refresher.refresh({ kind: 'hashName', hashName: 'Gold Ring (Rare)' });
    settle(0, 1);
    settle(1, 2);

    expect((await byKey).ok).toBe(true);
    expect((await byHash).ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});

/**
 * `connect` reads `window.bfc`, which this node-environment project can supply as a plain global,
 * so the arrival wiring runs for real rather than being asserted from source text.
 */
describe('createMarketSnapshotStore', () => {
  function withBridge<T>(bridge: unknown, run: () => T): T {
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

  /** Returns the `invoke` mock alongside the bridge: the bridge itself is cast to the contracts
   *  channel signature, which has no `.mock`. */
  function snapshotBridge(onPush: (listener: (view: unknown) => void) => void) {
    const invoke = vi.fn((_channel: string, _target?: unknown) => Promise.resolve({ snapshot: { items: [] } }));
    const bridge = {
      invoke,
      on: (_channel: string, listener: (view: unknown) => void) => {
        onPush(listener);
        return () => undefined;
      },
    } as unknown as Bridge;
    return { bridge, invoke };
  }

  it('reports bridge-unavailable rather than throwing when there is no preload bridge', () => {
    withBridge(undefined, () => {
      const { store } = createMarketSnapshotStore();

      store.start();

      expect(store.getState().status).toBe('bridge-unavailable');
    });
  });

  it('reads market:getSnapshot exactly once however many times it is started', async () => {
    const { bridge, invoke } = snapshotBridge(() => {});

    await withBridge(bridge, async () => {
      const { store } = createMarketSnapshotStore();

      store.start();
      store.start();
      await Promise.resolve();

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(store.getState().status).toBe('ready');
    });
  });

  it('keeps applying merged prices while nothing is subscribed, and the next subscriber sees them', async () => {
    let push: ((view: unknown) => void) | null = null;
    const { bridge } = snapshotBridge((listener) => {
      push = listener;
    });

    await withBridge(bridge, async () => {
      const { store } = createMarketSnapshotStore();
      store.start();
      await Promise.resolve();

      // Every subscriber has gone — Inventory is unmounted and another tab is showing.
      store.subscribe(() => {})();
      push?.({ snapshot: { items: ['priced'] } });

      const state = store.getState();
      expect(state.status).toBe('ready');
      expect(state.applied).toBe(2);
    });
  });

  it('shares one refresher across callers, so two asks for the same item are one rate-limited call', () => {
    const { bridge, invoke } = snapshotBridge(() => {});

    withBridge(bridge, () => {
      const { store, refresh } = createMarketSnapshotStore();
      store.start();

      void refresh({ kind: 'key', key: 'k1' });
      void refresh({ kind: 'key', key: 'k1' });

      const refreshCalls = invoke.mock.calls.filter(([channel]) => channel === 'market:refreshItem');
      expect(refreshCalls).toHaveLength(1);
    });
  });

  it('answers a refresh issued before connect with an unavailable quote rather than throwing', async () => {
    const { refresh } = createMarketSnapshotStore();

    await expect(refresh({ kind: 'key', key: 'k1' })).resolves.toMatchObject({ ok: false, reason: 'network' });
  });
});
