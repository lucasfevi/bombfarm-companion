import { describe, expect, it, vi } from 'vitest';
import type { MarketQuoteResult } from '@bombfarm/contracts';
import { createQuoteRefresher } from './use-market-snapshot';

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
