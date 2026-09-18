import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SKILLS_VIEW, loadSkillsView, saveSkillsView } from './skills-view-storage';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('skills view storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to gold per hour when nothing is stored', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    expect(loadSkillsView()).toEqual(DEFAULT_SKILLS_VIEW);
  });

  it('round-trips the objective and gate phase the reader last picked', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    saveSkillsView({ objective: 'gateClear', gatePhase: 20 });
    expect(loadSkillsView()).toEqual({ objective: 'gateClear', gatePhase: 20 });
  });

  it('loads a stored teamDps objective as gateClear', () => {
    const storage = memoryLocalStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem('bf-hp-skills-view-v1', '{"objective":"teamDps"}');
    expect(loadSkillsView()).toEqual({ objective: 'gateClear', gatePhase: null });
  });

  it('falls back when the stored value is not an objective', () => {
    const storage = memoryLocalStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem('bf-hp-skills-view-v1', '{"objective":"xpPerHour"}');
    expect(loadSkillsView()).toEqual(DEFAULT_SKILLS_VIEW);
  });
});
