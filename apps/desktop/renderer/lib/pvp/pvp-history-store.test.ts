import { describe, expect, it, vi } from 'vitest';
import { EMPTY_PVP_HISTORY, type PvpHistoryResult } from '@bombfarm/contracts';
import { accept, initialPvpHistoryState } from './pvp-history-store';
import { createPvpHistoryStore } from './use-pvp-history';

type Bridge = NonNullable<Window['bfc']>;

function history(duels: number): PvpHistoryResult {
  return { rows: [], totals: { duels, won: 0, films: 0 } };
}

describe('pvp history store', () => {
  it('reports an unavailable bridge instead of throwing', () => {
    const state = accept(initialPvpHistoryState, { kind: 'bridge-missing' });
    expect(state.status).toBe('bridge-unavailable');
    expect(accept(state, { kind: 'bridge-missing' })).toBe(state);
  });

  it('applies the mount read', () => {
    const state = accept(initialPvpHistoryState, { kind: 'fetched', history: history(1), issuedAt: 0 });
    expect(state.status).toBe('ready');
    expect(state.history?.totals.duels).toBe(1);
  });

  it('discards a mount read that a push overtook while it was in flight', () => {
    const pushed = accept(initialPvpHistoryState, { kind: 'pushed', history: history(2) });
    expect(accept(pushed, { kind: 'fetched', history: history(1), issuedAt: 0 })).toBe(pushed);
  });

  it('never blanks a list already on screen when a later read fails', () => {
    const pushed = accept(initialPvpHistoryState, { kind: 'pushed', history: history(2) });
    expect(accept(pushed, { kind: 'fetch-failed', issuedAt: 1 })).toBe(pushed);
    expect(accept(initialPvpHistoryState, { kind: 'fetch-failed', issuedAt: 0 }).status).toBe('unavailable');
  });
});

describe('createPvpHistoryStore', () => {
  it('reads the list once on start and folds every push after it', async () => {
    const handlers: ((history: PvpHistoryResult) => void)[] = [];
    const invoke = vi.fn(() => Promise.resolve(EMPTY_PVP_HISTORY));
    const on = vi.fn((_channel: string, handler: (history: PvpHistoryResult) => void) => {
      handlers.push(handler);
      return () => undefined;
    });
    const bridge = { invoke, on } as unknown as Bridge;

    const store = createPvpHistoryStore(() => bridge);
    store.start();
    store.start();
    await Promise.resolve();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('pvp:history');
    expect(on).toHaveBeenCalledWith('pvp:changed', expect.any(Function));
    expect(store.getState().status).toBe('ready');

    const seen: number[] = [];
    store.subscribe((state) => seen.push(state.history?.totals.duels ?? -1));
    handlers[0]?.(history(3));
    expect(seen).toEqual([3]);
  });

  it('settles to bridge-unavailable with no bridge, without invoking anything', () => {
    const store = createPvpHistoryStore(() => null);
    store.start();
    expect(store.getState().status).toBe('bridge-unavailable');
  });
});
