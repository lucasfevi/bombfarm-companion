import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import { attachAccountPersistence } from '@/shared/stores/persistence/persist-account';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

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

describe('account persistence subscription', () => {
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
    detach = attachAccountPersistence(usePlannerStore);
  });

  afterEach(() => {
    detach();
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('boot gate closed → no write; after boot one write per quiet period', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: {
        danoTotal: 1.5,
        critChance: 0,
        critDmg: 0,
        speed: 0,
        energy: 0,
        teamCoinPct: 0,
        glassCannon: false,
        tempoDobrado: false,
        abisso: false,
        abissoBase: 0,
        critDmgMult: 1,
        luckFlatPct: 0,
      },
      houseIdx: null,
      houseLevel: null,
      phase: null,
    });
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem('bf-hp-account-v1')).toBeNull();

    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().skipNextAccountToast();
    usePlannerStore.getState().applyAccountImport({
      tree: {
        danoTotal: 1.5,
        critChance: 3,
        critDmg: 0,
        speed: 2,
        energy: 0,
        teamCoinPct: 0,
        glassCannon: false,
        tempoDobrado: false,
        abisso: false,
        abissoBase: 0,
        critDmgMult: 1,
        luckFlatPct: 0,
      },
      houseIdx: null,
      houseLevel: null,
      phase: null,
    });
    vi.advanceTimersByTime(AUTOSAVE_MS - 1);
    expect(localStorage.getItem('bf-hp-account-v1')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(localStorage.getItem('bf-hp-account-v1')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('bf-hp-account-v1')!) as {
      tree: { danoTotal: number; critChance: number; speed: number };
    };
    expect(saved.tree.danoTotal).toBe(1.5);
    expect(saved.tree.critChance).toBe(3);
    expect(saved.tree.speed).toBe(2);
    expect(usePlannerStore.getState().toast).toBeNull();
  });

  it('toasts account saved unless skip one-shot', () => {
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().consumeSkipAccountToast();
    usePlannerStore.getState().setHouseIdx(1);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(usePlannerStore.getState().toast).toBe(STRINGS.pt.toastAccountSaved);
  });

  it('detach cancels pending timer', () => {
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().setHouseIdx(1);
    detach();
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem('bf-hp-account-v1')).toBeNull();
  });
});
