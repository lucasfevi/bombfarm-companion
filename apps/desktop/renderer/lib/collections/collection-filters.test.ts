import { describe, expect, it } from 'vitest';
import { acceptFilters, hasActiveFilters, initialCollectionFilters } from './collection-filters';

describe('acceptFilters', () => {
  it('starts on every bonus, every progress state and the bag filter off', () => {
    expect(initialCollectionFilters).toEqual({ axis: 'all', status: 'all', readyOnly: false });
    expect(hasActiveFilters(initialCollectionFilters)).toBe(false);
  });

  it('changes one filter and leaves the others as they were', () => {
    const withAxis = acceptFilters(initialCollectionFilters, { kind: 'axis', axis: 'gold' });
    const withStatus = acceptFilters(withAxis, { kind: 'status', status: 'started' });
    expect(acceptFilters(withStatus, { kind: 'ready-only', readyOnly: true })).toEqual({
      axis: 'gold',
      status: 'started',
      readyOnly: true,
    });
  });

  it('returns the same reference for an arrival that changes nothing', () => {
    const state = acceptFilters(initialCollectionFilters, { kind: 'axis', axis: 'gold' });
    expect(acceptFilters(state, { kind: 'axis', axis: 'gold' })).toBe(state);
    expect(acceptFilters(state, { kind: 'status', status: 'all' })).toBe(state);
    expect(acceptFilters(state, { kind: 'ready-only', readyOnly: false })).toBe(state);
    expect(acceptFilters(initialCollectionFilters, { kind: 'clear' })).toBe(initialCollectionFilters);
  });

  it('lets a tile press set the bonus filter and a second press on the same tile clear it', () => {
    const pressed = acceptFilters(initialCollectionFilters, { kind: 'toggle-axis', axis: 'luck' });
    expect(pressed.axis).toBe('luck');
    expect(acceptFilters(pressed, { kind: 'toggle-axis', axis: 'luck' }).axis).toBe('all');
  });

  it('moves a tile press from one bonus straight to another', () => {
    const pressed = acceptFilters(initialCollectionFilters, { kind: 'toggle-axis', axis: 'luck' });
    expect(acceptFilters(pressed, { kind: 'toggle-axis', axis: 'xp' }).axis).toBe('xp');
  });

  it('clears all three at once', () => {
    const busy = { axis: 'gold', status: 'complete', readyOnly: true } as const;
    expect(hasActiveFilters(busy)).toBe(true);
    expect(acceptFilters(busy, { kind: 'clear' })).toEqual(initialCollectionFilters);
  });
});
