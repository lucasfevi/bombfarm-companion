import { describe, expect, it, vi } from 'vitest';
import { createForgePageStore, DEFAULT_FORGE_PAGE, isForgePageId } from './forge-page-store';

describe('the Forge page store', () => {
  it('opens on the forge itself', () => {
    expect(DEFAULT_FORGE_PAGE).toBe('forge');
    expect(createForgePageStore().getPage()).toBe('forge');
  });

  it('remembers the page chosen and tells subscribers once per change', () => {
    const store = createForgePageStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setPage('deconstruct');
    store.setPage('deconstruct');
    expect(store.getPage()).toBe('deconstruct');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('recognizes only the two pages', () => {
    expect(isForgePageId('forge')).toBe(true);
    expect(isForgePageId('deconstruct')).toBe(true);
    expect(isForgePageId('queue')).toBe(false);
  });
});
