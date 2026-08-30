import { describe, expect, it } from 'vitest';
import { accept, initialMarketState, quoteTargetId, type MarketState, type MarketView } from './market-store';

function view(publishedUtc: string): MarketView {
  return {
    snapshot: null,
    source: 'network',
    publishedUtc,
    adoptedUtc: publishedUtc,
    checkedUtc: publishedUtc,
    lastError: null,
  };
}

const ready = (state: MarketState): MarketView | null => (state.status === 'ready' ? state.view : null);

describe('market store', () => {
  it('reports an unavailable bridge instead of throwing', () => {
    const state = accept(initialMarketState, { kind: 'bridge-missing' });
    expect(state.status).toBe('bridge-unavailable');
    expect(accept(state, { kind: 'bridge-missing' })).toBe(state);
  });

  it('applies the mount read', () => {
    const state = accept(initialMarketState, { kind: 'fetched', view: view('a'), issuedAt: 0 });
    expect(ready(state)?.publishedUtc).toBe('a');
  });

  it('discards a mount read that a push overtook while it was in flight', () => {
    const pushed = accept(initialMarketState, { kind: 'pushed', view: view('newer') });
    const afterLateFetch = accept(pushed, { kind: 'fetched', view: view('older'), issuedAt: 0 });

    expect(afterLateFetch).toBe(pushed);
    expect(ready(afterLateFetch)?.publishedUtc).toBe('newer');
  });

  it('never blanks prices already on screen when a later read fails', () => {
    const pushed = accept(initialMarketState, { kind: 'pushed', view: view('a') });
    const afterFailure = accept(pushed, { kind: 'fetch-failed', issuedAt: 1 });

    expect(afterFailure).toBe(pushed);
    expect(ready(afterFailure)?.publishedUtc).toBe('a');
  });

  it('surfaces a failure only when nothing has ever been applied', () => {
    expect(accept(initialMarketState, { kind: 'fetch-failed', issuedAt: 0 }).status).toBe('unavailable');
  });
});

describe('quoteTargetId', () => {
  it('separates a key from a hash name that happens to read the same', () => {
    expect(quoteTargetId({ kind: 'key', key: 'x' })).not.toBe(quoteTargetId({ kind: 'hashName', hashName: 'x' }));
  });

  it('is stable for the same target', () => {
    expect(quoteTargetId({ kind: 'key', key: 'ember_luva#2' })).toBe(quoteTargetId({ kind: 'key', key: 'ember_luva#2' }));
  });
});
