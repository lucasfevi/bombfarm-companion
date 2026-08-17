'use client';

import { useEffect, useRef } from 'react';
import type { HeroRecord } from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores';

/**
 * Compat surface for draft/build action hooks — toast/booted/lock live in the session slice.
 * Autosave is store-subscription-driven; this hook only exposes lock helpers.
 */
export type HeroPersistSession = {
  toast: string | null;
  flashToast: (message: string) => void;
  booted: boolean;
  beginHeroMutation: () => void;
  skipNextHeroToast: () => void;
  skipNextAccountToast: () => void;
  consumeSkipHeroToast: () => boolean;
  consumeSkipAccountToast: () => boolean;
  /** Defer unlock after apply/reset so StrictMode's aborted mount can cancel via boot effect. */
  scheduleUnlock: (extra?: () => void) => void;
  unlockPersistNow: () => void;
};

export function useHeroPersistSession(): HeroPersistSession {
  const toast = usePlannerStore((state) => state.toast);
  const flashToast = usePlannerStore((state) => state.flashToast);
  const booted = usePlannerStore((state) => state.booted);
  const beginHeroMutation = usePlannerStore((state) => state.beginHeroMutation);
  const skipNextHeroToast = usePlannerStore((state) => state.skipNextHeroToast);
  const skipNextAccountToast = usePlannerStore((state) => state.skipNextAccountToast);
  const consumeSkipHeroToast = usePlannerStore((state) => state.consumeSkipHeroToast);
  const consumeSkipAccountToast = usePlannerStore((state) => state.consumeSkipAccountToast);
  const unlockPersist = usePlannerStore((state) => state.unlockPersist);

  const unlockPersistNow = () => {
    unlockPersist();
  };

  const scheduleUnlock = (extra?: () => void) => {
    queueMicrotask(() => {
      extra?.();
      unlockPersist();
    });
  };

  return {
    toast,
    flashToast,
    booted,
    beginHeroMutation,
    skipNextHeroToast,
    skipNextAccountToast,
    consumeSkipHeroToast,
    consumeSkipAccountToast,
    scheduleUnlock,
    unlockPersistNow,
  };
}

export type HeroPersistEffectInput = {
  applyHero: (h: HeroRecord) => void;
};

/**
 * Boot apply for active hero (MOD-46 / W4-09).
 * Debounced saves live in shared/stores/persistence (draft-field subscription).
 */
export function useHeroPersistEffects(input: HeroPersistEffectInput): void {
  const { applyHero } = input;

  const applyHeroRef = useRef(applyHero);
  applyHeroRef.current = applyHero;

  // Idempotent boot: defer work so StrictMode's aborted mount cancels before apply.
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const state = usePlannerStore.getState();
      const heroId = state.activeHeroId;
      if (heroId) {
        const hero = state.heroes.find((candidate) => candidate.id === heroId);
        if (hero) applyHeroRef.current(hero);
        else state.unlockPersist();
      } else {
        state.unlockPersist();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);
}

/** Alias matching the B2 plan name — effects entrypoint. */
export const useHeroPersistence = useHeroPersistEffects;
