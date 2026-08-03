import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import {
  clearSessionTimersForTests,
  setHeroSaveRescheduler,
} from '@/shared/stores/slices/session-slice';
import { selectStrings } from '@/shared/stores/selectors/session-selectors';
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

describe('session slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryLocalStorage());
    vi.stubGlobal('document', {
      documentElement: { lang: '' },
    });
    resetPlannerStoreForTests();
    clearSessionTimersForTests();
  });

  afterEach(() => {
    clearSessionTimersForTests();
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts with pt lang, null toast, booted false, and all three gates true', () => {
    const s = usePlannerStore.getState();
    expect(s.lang).toBe('pt');
    expect(s.toast).toBeNull();
    expect(s.booted).toBe(false);
    expect(s.isPersistSuppressed).toBe(true);
    expect(s.shouldSkipHeroToast).toBe(true);
    expect(s.shouldSkipAccountToast).toBe(true);
  });

  it('setLang writes bf_lang and documentElement.lang; hydrateLang sets document only', () => {
    usePlannerStore.getState().setLang('en');
    expect(usePlannerStore.getState().lang).toBe('en');
    expect(localStorage.getItem('bf_lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    localStorage.removeItem('bf_lang');
    usePlannerStore.getState().hydrateLang('pt');
    expect(usePlannerStore.getState().lang).toBe('pt');
    expect(localStorage.getItem('bf_lang')).toBeNull();
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('setLang with the same value does not change state identity', () => {
    const before = usePlannerStore.getState();
    before.setLang('pt');
    expect(usePlannerStore.getState()).toBe(before);
  });

  it('flashToast clears after 1800 ms and a second call cancels the first timer', () => {
    usePlannerStore.getState().flashToast('one');
    expect(usePlannerStore.getState().toast).toBe('one');
    vi.advanceTimersByTime(1000);
    usePlannerStore.getState().flashToast('two');
    expect(usePlannerStore.getState().toast).toBe('two');
    vi.advanceTimersByTime(1800);
    expect(usePlannerStore.getState().toast).toBeNull();
  });

  it('consumeSkipHeroToast / consumeSkipAccountToast read and clear', () => {
    expect(usePlannerStore.getState().consumeSkipHeroToast()).toBe(true);
    expect(usePlannerStore.getState().consumeSkipHeroToast()).toBe(false);
    expect(usePlannerStore.getState().shouldSkipHeroToast).toBe(false);

    expect(usePlannerStore.getState().consumeSkipAccountToast()).toBe(true);
    expect(usePlannerStore.getState().consumeSkipAccountToast()).toBe(false);
  });

  it('beginHeroMutation sets suppress + skip hero toast', () => {
    usePlannerStore.getState().unlockPersist();
    usePlannerStore.getState().consumeSkipHeroToast();
    usePlannerStore.getState().beginHeroMutation();
    const s = usePlannerStore.getState();
    expect(s.isPersistSuppressed).toBe(true);
    expect(s.shouldSkipHeroToast).toBe(true);
  });

  it('unlockPersist clears the lock and calls the registered re-arm callback', () => {
    const rearm = vi.fn();
    setHeroSaveRescheduler(rearm);
    usePlannerStore.getState().unlockPersist();
    expect(usePlannerStore.getState().isPersistSuppressed).toBe(false);
    expect(rearm).toHaveBeenCalledTimes(1);
    setHeroSaveRescheduler(null);
  });

  it('selectStrings is referentially stable for a given lang', () => {
    const a = selectStrings(usePlannerStore.getState());
    const b = selectStrings(usePlannerStore.getState());
    expect(a).toBe(b);
    expect(a).toBe(STRINGS.pt);
    usePlannerStore.getState().setLang('en');
    expect(selectStrings(usePlannerStore.getState())).toBe(STRINGS.en);
  });
});
