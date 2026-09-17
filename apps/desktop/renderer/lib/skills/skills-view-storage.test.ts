import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SKILLS_VIEW, loadSkillsView, saveSkillsView } from './skills-view-storage';

const KEY = 'bfc-skills-view';

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

describe('skill tree view preferences', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('is stored under its own key, never the farm screen key', () => {
    saveSkillsView({ objective: 'teamDps' });
    expect([...entries.keys()]).toEqual([KEY]);
  });

  it('round-trips the objective', () => {
    saveSkillsView({ objective: 'teamDps' });
    expect(loadSkillsView()).toEqual({ objective: 'teamDps' });
  });

  it('reads the defaults when nothing was ever stored', () => {
    expect(loadSkillsView()).toEqual(DEFAULT_SKILLS_VIEW);
  });

  it('reads the defaults for an objective it does not know', () => {
    entries.set(KEY, JSON.stringify({ objective: 'luck' }));
    expect(loadSkillsView()).toEqual(DEFAULT_SKILLS_VIEW);
  });

  it('reads the defaults for a value that is not JSON', () => {
    entries.set(KEY, '{not json');
    expect(loadSkillsView()).toEqual(DEFAULT_SKILLS_VIEW);
  });

  it('reads the defaults when storage throws', () => {
    (globalThis as unknown as { window: FakeWindow }).window = {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
      } as unknown as Storage,
    };
    expect(loadSkillsView()).toEqual(DEFAULT_SKILLS_VIEW);
  });
});
