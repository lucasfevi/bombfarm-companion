import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(): string {
  return readFileSync(path.join(__dirname, 'use-live-model.ts'), 'utf8');
}

describe('useLiveModel — structural guarantee that the store is owned by one effect per mount', () => {
  it('declares exactly one useEffect, with an empty dependency array', () => {
    const src = source();

    expect(src.match(/useEffect\(/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/\},\s*\[\]\);/);
  });

  it('is a single useState — no other React state', () => {
    expect(source().match(/useState[<(]/g) ?? []).toHaveLength(1);
  });

  it('starts the store and subscribes inside the effect, and stops it in the cleanup', () => {
    const src = source();

    expect(src).toContain('store.start()');
    expect(src).toContain('store.subscribe(setModel)');
    expect(src).toMatch(/return \(\) => \{[\s\S]*store\.stop\(\);[\s\S]*\};/);
  });

  it('reads the initial snapshot from the store rather than waiting for the first notification', () => {
    expect(source()).toContain('setModel(store.getModel())');
  });
});
