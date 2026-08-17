import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isPlannerTabId,
  loadPlannerTab,
  PLANNER_TAB_IDS,
  PLANNER_TAB_STORAGE_KEY,
} from '@/features/planner/model/planner-tab';

describe('planner-tab persistence (PTI-04)', () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
        removeItem: (k: string) => {
          mem.delete(k);
        },
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('accepts only locked tab ids', () => {
    expect(PLANNER_TAB_IDS).toEqual(['hero', 'gear', 'account', 'points']);
    expect(isPlannerTabId('points')).toBe(true);
    expect(isPlannerTabId('items')).toBe(false);
  });

  it('defaults to points when setup ready, else hero', () => {
    expect(loadPlannerTab(true)).toBe('points');
    expect(loadPlannerTab(false)).toBe('hero');
  });

  it('reads stored tab when valid', () => {
    localStorage.setItem(PLANNER_TAB_STORAGE_KEY, 'gear');
    expect(loadPlannerTab(true)).toBe('gear');
    localStorage.setItem(PLANNER_TAB_STORAGE_KEY, 'nope');
    expect(loadPlannerTab(true)).toBe('points');
  });
});
