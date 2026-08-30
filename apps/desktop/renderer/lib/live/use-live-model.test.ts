import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createLiveStoreHolder } from './use-live-model';
import type { LiveStore } from './live-store';

function source(): string {
  return readFileSync(path.join(__dirname, 'use-live-model.ts'), 'utf8');
}

function fakeStore(): LiveStore {
  return {
    getModel: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

describe('createLiveStoreHolder', () => {
  it('builds the store once and hands every later caller the same one', () => {
    const make = vi.fn(fakeStore);
    const holder = createLiveStoreHolder(make);

    const first = holder();
    const second = holder();
    const third = holder();

    expect(make).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('does not build the store until it is first asked for', () => {
    const make = vi.fn(fakeStore);

    createLiveStoreHolder(make);

    expect(make).not.toHaveBeenCalled();
  });
});

describe('useLiveModel — structural guarantee that the store outlives the mount', () => {
  it('declares exactly one useEffect, with an empty dependency array', () => {
    const src = source();

    expect(src.match(/useEffect\(/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/\},\s*\[\]\);/);
  });

  it('is a single useState — no other React state', () => {
    expect(source().match(/useState[<(]/g) ?? []).toHaveLength(1);
  });

  it('takes the store from the shared holder rather than building one per mount', () => {
    const src = source();

    expect(src).toContain('const store = sharedLiveStore();');
    expect(src.match(/createLiveStore\(/g) ?? []).toHaveLength(1);
    expect(src).not.toMatch(/useEffect\(\(\) => \{[\s\S]*createLiveStore\(/);
  });

  it('starts the store and subscribes inside the effect', () => {
    const src = source();

    expect(src).toContain('store.start()');
    expect(src).toContain('store.subscribe(setModel)');
  });

  it('never stops the store — a torn-down subscription is what put a spinner on every return to the tab', () => {
    expect(source()).not.toContain('store.stop()');
  });

  it('reads the initial snapshot from the store rather than waiting for the first notification', () => {
    expect(source()).toContain('setModel(store.getModel())');
  });
});
