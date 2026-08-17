/**
 * MOD-21 tripwire — must pass unmodified at every W4/W5+ commit.
 * Fixture: as `writeJson` serializes after normalizeHero/Account (build 35fe328).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { resetPlannerStoreForTests } from '@/shared/stores';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';
import { saveAccountShared, saveHeroes, setActiveHeroId } from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores/planner-store';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const fixturePath = join(WEB_PACKAGE_ROOT, 'src/tests/fixtures/storage-roundtrip-20260729.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  _meta: { comment: string; build: string };
  'bf-hp-heroes-v1': string;
  'bf-hp-active-hero-v1': string;
  'bf-hp-account-v1': string;
};

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

describe('storage round-trip (MOD-21)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('hydrates a main-captured save and re-serializes byte-identically with no mutation', () => {
    localStorage.setItem('bf-hp-heroes-v1', fixture['bf-hp-heroes-v1']);
    localStorage.setItem('bf-hp-active-hero-v1', fixture['bf-hp-active-hero-v1']);
    localStorage.setItem('bf-hp-account-v1', fixture['bf-hp-account-v1']);

    hydratePlannerStore();

    // Re-serialize from store state via the same writers (no field mutation).
    saveHeroes(usePlannerStore.getState().heroes);
    setActiveHeroId(usePlannerStore.getState().activeHeroId);
    saveAccountShared(selectAccountShared(usePlannerStore.getState()));

    expect(localStorage.getItem('bf-hp-heroes-v1')).toBe(fixture['bf-hp-heroes-v1']);
    expect(localStorage.getItem('bf-hp-active-hero-v1')).toBe(fixture['bf-hp-active-hero-v1']);
    expect(localStorage.getItem('bf-hp-account-v1')).toBe(fixture['bf-hp-account-v1']);
  });

  it('fixture covers multi-hero array, bare-string active id, and account object', () => {
    expect(fixture['bf-hp-heroes-v1'].startsWith('[{')).toBe(true);
    expect(fixture['bf-hp-heroes-v1']).toContain('"hero-1"');
    expect(fixture['bf-hp-heroes-v1']).toContain('"hero-2"');
    expect(fixture['bf-hp-active-hero-v1']).toBe('"hero-1"');
    expect(fixture['bf-hp-account-v1'].startsWith('{')).toBe(true);
    expect(fixture._meta.build).toBe('35fe328');
  });
});
