import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROSTER_VIEW_PREFS, type RosterViewPrefs } from '@bombfarm/hero/model';
import { loadHeroesView, saveHeroesView } from './heroes-view-storage';

type FakeWindow = { localStorage: Storage };

function installStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as Storage;
  (globalThis as unknown as { window?: FakeWindow }).window = { localStorage: storage };
  return entries;
}

describe('heroes view preferences', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('round-trips what was written, under its own key', () => {
    const view: RosterViewPrefs = {
      ...DEFAULT_ROSTER_VIEW_PREFS,
      viewMode: 'cards',
      sort: { key: 'roll', direction: 'asc' },
      filter: { abilityIds: ['olho_clinico'], activeOnly: true },
      showcaseView: { showLevels: true },
    };
    saveHeroesView(view);
    expect([...entries.keys()]).toEqual(['bfc-heroes-view']);
    expect(loadHeroesView()).toEqual(view);
  });

  it('reads the defaults when nothing, or nothing readable, was stored', () => {
    expect(loadHeroesView()).toEqual(DEFAULT_ROSTER_VIEW_PREFS);
    entries.set('bfc-heroes-view', '{not json');
    expect(loadHeroesView()).toEqual(DEFAULT_ROSTER_VIEW_PREFS);
  });

  it('reads the defaults when storage itself is unavailable', () => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
    expect(loadHeroesView()).toEqual(DEFAULT_ROSTER_VIEW_PREFS);
    expect(() => {
      saveHeroesView(DEFAULT_ROSTER_VIEW_PREFS);
    }).not.toThrow();
  });
});
