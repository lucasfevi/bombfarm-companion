import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DECONSTRUCT_FILTER } from './deconstruct-rows';
import { createDeconstructScreenStore, DEFAULT_DECONSTRUCT_SORT, INITIAL_DECONSTRUCT_SCREEN } from './deconstruct-store';

describe('the Deconstruct screen store', () => {
  it('opens on the default filter, the game order and an empty batch', () => {
    const store = createDeconstructScreenStore();
    expect(store.getState()).toEqual(INITIAL_DECONSTRUCT_SCREEN);
    expect(store.getState().filter).toBe(EMPTY_DECONSTRUCT_FILTER);
    expect(DEFAULT_DECONSTRUCT_SORT).toEqual([
      { key: 'level', direction: 'desc' },
      { key: 'rarity', direction: 'desc' },
    ]);
  });

  it('keeps the filter, the order and the batch across a subscriber leaving and another arriving', () => {
    const store = createDeconstructScreenStore();
    const first = store.subscribe(() => undefined);
    store.setFilter({ ...EMPTY_DECONSTRUCT_FILTER, text: 'glacier' });
    store.setSort([{ key: 'name', direction: 'asc' }]);
    store.setSelection(['a', 'b']);
    first();

    const second = vi.fn();
    store.subscribe(second);
    expect(store.getState().filter.text).toBe('glacier');
    expect(store.getState().sort).toEqual([{ key: 'name', direction: 'asc' }]);
    expect(store.getState().selectedIds).toEqual(['a', 'b']);
    expect(second).not.toHaveBeenCalled();
  });

  it('holds the essence order across a visit elsewhere and drops it the moment the sort moves', () => {
    const store = createDeconstructScreenStore();
    const first = store.subscribe(() => undefined);
    store.setEssenceSort('asc');
    first();
    expect(store.getState().essenceSort).toBe('asc');

    const listener = vi.fn();
    store.subscribe(listener);
    store.setEssenceSort('asc');
    expect(listener).not.toHaveBeenCalled();

    store.setSort([{ key: 'name', direction: 'asc' }]);
    expect(store.getState().essenceSort).toBeNull();
  });

  it('tells subscribers once per change and not at all for a write that changes nothing', () => {
    const store = createDeconstructScreenStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const ids = ['a'];
    store.setSelection(ids);
    store.setSelection(ids);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('drops burned ids from the batch and leaves the other ticks where they were', () => {
    const store = createDeconstructScreenStore();
    store.setSelection(['a', 'b', 'c']);
    store.unselect(['b', 'zzz']);
    expect(store.getState().selectedIds).toEqual(['a', 'c']);
  });

  it('does not notify when the burned ids were never ticked', () => {
    const store = createDeconstructScreenStore();
    store.setSelection(['a']);
    const listener = vi.fn();
    store.subscribe(listener);
    store.unselect(['z']);
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the batch the first time it learns the account and when the same account is read again', () => {
    const store = createDeconstructScreenStore();
    store.setSelection(['a', 'b']);
    expect(store.adoptAccount('486')).toBe(false);
    expect(store.adoptAccount('486')).toBe(false);
    expect(store.getState().selectedIds).toEqual(['a', 'b']);
    expect(store.getState().accountKey).toBe('486');
  });

  it('empties the batch when a different account is read, and keeps the filter and the order', () => {
    const store = createDeconstructScreenStore();
    store.adoptAccount('486');
    store.setFilter({ ...EMPTY_DECONSTRUCT_FILTER, text: 'glacier' });
    store.setSelection(['a', 'b']);
    expect(store.adoptAccount('11882')).toBe(true);
    expect(store.getState().selectedIds).toEqual([]);
    expect(store.getState().filter.text).toBe('glacier');
    expect(store.getState().accountKey).toBe('11882');
  });

  it('ignores a read that names no account, so a partial read cannot pass for a switch', () => {
    const store = createDeconstructScreenStore();
    store.adoptAccount('486');
    store.setSelection(['a']);
    expect(store.adoptAccount(null)).toBe(false);
    expect(store.getState().selectedIds).toEqual(['a']);
    expect(store.getState().accountKey).toBe('486');
  });

  it('resets to the opening state', () => {
    const store = createDeconstructScreenStore();
    store.setSelection(['a']);
    store.reset();
    expect(store.getState()).toBe(INITIAL_DECONSTRUCT_SCREEN);
  });
});
