import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(): string {
  return readFileSync(path.join(__dirname, 'use-live-model.ts'), 'utf8');
}

describe('useLiveModel — structural guarantee that the store outlives the mount', () => {
  it('declares exactly one useEffect, with an empty dependency array', () => {
    const src = source();

    expect(src.match(/useEffect\(/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/\},\s*\[\]\);/);
  });

  it('is a single useState — no other React state', () => {
    expect(source().match(/useState[<(]/g) ?? []).toHaveLength(1);
  });

  it('takes the store from a window-lifetime singleton rather than building one per mount', () => {
    const src = source();

    expect(src).toContain('createLazySingleton(');
    expect(src).toContain('const store = sharedLiveStore();');
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

  it('seeds the very first render from the store, so a remount never paints a loading frame', () => {
    expect(source()).toContain('useState<LiveModel>(() => sharedLiveStore().getModel())');
  });

  it('constructs the store without touching window, so the first render can read it', () => {
    const src = source();

    expect(src).toMatch(/get bridge\(\)/);
    expect(src).not.toMatch(/createLiveStore\(\{ bridge: \(window/);
  });
});
