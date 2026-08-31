import type { StateCreator } from 'zustand';
import type { RankMode } from '@bombfarm/domain/model';
import type { Lang } from '@/shared/i18n';
import { saveLang } from '@/shared/i18n';
import type { PlannerStore } from '@/shared/stores/planner-store';

const TOAST_MS = 1800;

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let heroSaveRescheduler: (() => void) | null = null;

/** Persistence layer registers the hero-channel re-arm callback (unlockPersist). */
export function setHeroSaveRescheduler(callback: (() => void) | null): void {
  heroSaveRescheduler = callback;
}

export function clearSessionTimersForTests(): void {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

export type SessionSlice = {
  lang: Lang;
  toast: string | null;
  booted: boolean;
  isPersistSuppressed: boolean;
  shouldSkipHeroToast: boolean;
  shouldSkipAccountToast: boolean;
  /** Shell-owned import dialog — replaces AppShellBridge openImport. */
  importDialogOpen: boolean;
  /**
   * What the Points tab's on-demand Optimize build search scores against. Deliberately NOT
   * `rankMode`: that one drives the Next point panel's ranking, and a player may reasonably
   * rank their next point by farm rate while reallocating a whole build for damage. Session
   * state, not account context — nothing about it is worth carrying into a save.
   */
  optimizeMode: RankMode;

  setLang: (next: Lang) => void;
  hydrateLang: (lang: Lang) => void;
  flashToast: (message: string) => void;
  clearToast: () => void;
  setBooted: (booted: boolean) => void;
  beginHeroMutation: () => void;
  skipNextHeroToast: () => void;
  skipNextAccountToast: () => void;
  consumeSkipHeroToast: () => boolean;
  consumeSkipAccountToast: () => boolean;
  unlockPersist: () => void;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  setImportDialogOpen: (open: boolean) => void;
  setOptimizeMode: (next: RankMode) => void;
};

export const createSessionSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  SessionSlice
> = (set, get) => ({
  lang: 'pt',
  toast: null,
  booted: false,
  isPersistSuppressed: true,
  shouldSkipHeroToast: true,
  shouldSkipAccountToast: true,
  importDialogOpen: false,
  optimizeMode: 'dps',

  setLang: (next) => {
    const previous = get().lang;
    if (previous === next) return;
    saveLang(next);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next === 'pt' ? 'pt-BR' : 'en';
    }
    set({ lang: next });
  },

  hydrateLang: (lang) => {
    const previous = get().lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    }
    if (previous === lang) return;
    set({ lang });
  },

  flashToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => {
      toastTimer = null;
      set({ toast: null });
    }, TOAST_MS);
  },

  clearToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null });
  },

  setBooted: (booted) => {
    if (get().booted === booted) return;
    set({ booted });
  },

  beginHeroMutation: () => {
    set({ isPersistSuppressed: true, shouldSkipHeroToast: true });
  },

  skipNextHeroToast: () => {
    set({ shouldSkipHeroToast: true });
  },

  skipNextAccountToast: () => {
    set({ shouldSkipAccountToast: true });
  },

  consumeSkipHeroToast: () => {
    if (!get().shouldSkipHeroToast) return false;
    set({ shouldSkipHeroToast: false });
    return true;
  },

  consumeSkipAccountToast: () => {
    if (!get().shouldSkipAccountToast) return false;
    set({ shouldSkipAccountToast: false });
    return true;
  },

  unlockPersist: () => {
    set({ isPersistSuppressed: false });
    heroSaveRescheduler?.();
  },

  openImportDialog: () => {
    if (get().importDialogOpen) return;
    set({ importDialogOpen: true });
  },

  closeImportDialog: () => {
    if (!get().importDialogOpen) return;
    set({ importDialogOpen: false });
  },

  setImportDialogOpen: (open) => {
    if (get().importDialogOpen === open) return;
    set({ importDialogOpen: open });
  },

  setOptimizeMode: (next) => {
    if (get().optimizeMode === next) return;
    set({ optimizeMode: next });
  },
});
