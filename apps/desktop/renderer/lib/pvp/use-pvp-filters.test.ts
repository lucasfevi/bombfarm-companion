import { describe, expect, it, vi } from 'vitest';
import { ALL_OPPONENTS } from './pvp-rows';
import { accept, createPvpFiltersStore, initialPvpFilters } from './use-pvp-filters';

describe('accept', () => {
  it('starts on every opponent and every result', () => {
    expect(initialPvpFilters).toEqual({ opponent: ALL_OPPONENTS, result: 'all' });
  });

  it('changes one filter and leaves the other as it was', () => {
    const withOpponent = accept(initialPvpFilters, { kind: 'opponent', opponent: 'Ana' });
    expect(withOpponent).toEqual({ opponent: 'Ana', result: 'all' });
    expect(accept(withOpponent, { kind: 'result', result: 'lost' })).toEqual({ opponent: 'Ana', result: 'lost' });
  });

  it('returns the same reference for an arrival that changes nothing', () => {
    const state = accept(initialPvpFilters, { kind: 'opponent', opponent: 'Ana' });
    expect(accept(state, { kind: 'opponent', opponent: 'Ana' })).toBe(state);
    expect(accept(state, { kind: 'result', result: 'all' })).toBe(state);
  });
});

describe('createPvpFiltersStore', () => {
  it('tells every subscriber about a change and keeps the state for a later reader', () => {
    const { store, setOpponent, setResult } = createPvpFiltersStore();
    const listener = vi.fn();
    store.subscribe(listener);

    setOpponent('Ana');
    setResult('won');
    setResult('won');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getState()).toEqual({ opponent: 'Ana', result: 'won' });
  });
});
