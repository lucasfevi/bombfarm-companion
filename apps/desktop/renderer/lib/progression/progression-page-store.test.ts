import { describe, expect, it, vi } from 'vitest';
import {
  createProgressionPageStore,
  DEFAULT_PROGRESSION_PAGE,
  isProgressionPageId,
} from './progression-page-store';

describe('the Progression page store', () => {
  it('opens on the Skill Tree page', () => {
    expect(DEFAULT_PROGRESSION_PAGE).toBe('skills');
    expect(createProgressionPageStore().getPage()).toBe('skills');
  });

  it('remembers the page chosen and tells subscribers once per change', () => {
    const store = createProgressionPageStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setPage('collections');
    store.setPage('collections');
    expect(store.getPage()).toBe('collections');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops telling a subscriber once it unsubscribes', () => {
    const store = createProgressionPageStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setPage('collections');
    expect(listener).not.toHaveBeenCalled();
  });

  it('recognizes only the two pages', () => {
    expect(isProgressionPageId('skills')).toBe(true);
    expect(isProgressionPageId('collections')).toBe(true);
    expect(isProgressionPageId('progression')).toBe(false);
    expect(isProgressionPageId('settings')).toBe(false);
  });
});
