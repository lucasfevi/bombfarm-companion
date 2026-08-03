'use client';

import { useCallback, useRef } from 'react';
import { sheetsFromBirth } from '@bombfarm/domain/birth-sheet';
import { rescaleHeroForLevel, rescaleHeroForStars } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@/shared/lib/storage';
import { usePlannerStore, selectAdvisorPipeline, selectTreeSheetTotals } from '@/shared/stores';
import { useHeroPersistSession } from './use-hero-persistence';

export type HeroDraftActionsOptions = {
  /** Fired when the active hero id is written (strip, import pick, delete, …). */
  onActiveHeroChange?: (heroId: string | null) => void;
};

export function useHeroDraftActions(options?: HeroDraftActionsOptions) {
  const persist = useHeroPersistSession();
  const onActiveHeroChangeRef = useRef(options?.onActiveHeroChange);
  onActiveHeroChangeRef.current = options?.onActiveHeroChange;

  const heroId = usePlannerStore((state) => state.activeHeroId);
  const setHeroId = usePlannerStore((state) => state.setActiveHeroId);
  const setSkipPhaseMitigationSync = usePlannerStore((state) => state.setSkipPhaseMitigationSync);
  const storeApplyHero = usePlannerStore((state) => state.applyHero);
  const resetDraftToDefaults = usePlannerStore((state) => state.resetDraftToDefaults);
  const setHeroName = usePlannerStore((state) => state.setHeroName);
  const removeHero = usePlannerStore((state) => state.removeHero);
  const setHeroLevel = usePlannerStore((state) => state.setHeroLevel);
  const setStarsStore = usePlannerStore((state) => state.setStars);
  const setNaked = usePlannerStore((state) => state.setNaked);
  const setGearedOverride = usePlannerStore((state) => state.setGearedOverride);

  const loadout = usePlannerStore((state) => state.loadout);
  const gearedOverride = usePlannerStore((state) => state.gearedOverride);
  const naked = usePlannerStore((state) => state.naked);
  const level = usePlannerStore((state) => state.level);
  const stars = usePlannerStore((state) => state.stars);

  const loadoutRef = useRef(loadout);
  loadoutRef.current = loadout;
  const gearedOverrideRef = useRef(gearedOverride);
  gearedOverrideRef.current = gearedOverride;
  const nakedRef = useRef(naked);
  nakedRef.current = naked;
  const levelRef = useRef(level);
  levelRef.current = level;
  const starsRef = useRef(stars);
  starsRef.current = stars;

  const readSheetOther = () => selectAdvisorPipeline(usePlannerStore.getState()).sheetOther;

  const { beginHeroMutation, scheduleUnlock } = persist;

  const applyHero = useCallback(
    (hero: HeroRecord) => {
      beginHeroMutation();
      setSkipPhaseMitigationSync(true);
      setHeroId(hero.id);
      onActiveHeroChangeRef.current?.(hero.id);
      storeApplyHero(hero);
      scheduleUnlock(() => setSkipPhaseMitigationSync(false));
    },
    [beginHeroMutation, scheduleUnlock, setHeroId, setSkipPhaseMitigationSync, storeApplyHero],
  );

  const resetHeroFields = useCallback(() => {
    beginHeroMutation();
    setSkipPhaseMitigationSync(true);
    setHeroId(null);
    onActiveHeroChangeRef.current?.(null);
    resetDraftToDefaults();
    setHeroName('New hero');
    scheduleUnlock(() => setSkipPhaseMitigationSync(false));
  }, [
    beginHeroMutation,
    resetDraftToDefaults,
    scheduleUnlock,
    setHeroId,
    setHeroName,
    setSkipPhaseMitigationSync,
  ]);

  const handleDeleteHero = useCallback(() => {
    if (!heroId) return;
    beginHeroMutation();
    removeHero(heroId);
    const remaining = usePlannerStore.getState().heroes;
    if (remaining.length > 0) {
      applyHero(remaining[0]);
    } else {
      resetHeroFields();
    }
  }, [applyHero, beginHeroMutation, heroId, removeHero, resetHeroFields]);

  const changeLevel = useCallback(
    (toLevel: number) => {
      const clampedLevel = Math.max(0, Math.min(100, Math.round(toLevel)));
      const from = levelRef.current;
      if (clampedLevel === from) return;
      const state = usePlannerStore.getState();
      const sheetOther = readSheetOther();
      const birth = state.birth;
      const next = birth
        ? sheetsFromBirth({
            birth,
            level: clampedLevel,
            stars: starsRef.current,
            sheetOther,
            loadout: loadoutRef.current,
            tree: selectTreeSheetTotals(state),
          })
        : rescaleHeroForLevel(
            nakedRef.current,
            gearedOverrideRef.current,
            loadoutRef.current,
            sheetOther,
            from,
            clampedLevel,
          );
      setHeroLevel(clampedLevel);
      setNaked(next.naked);
      setGearedOverride(next.geared);
    },
    [setGearedOverride, setHeroLevel, setNaked],
  );

  const changeStars = useCallback(
    (toStars: number) => {
      const clampedStars = Math.max(0, Math.min(3, Math.round(toStars)));
      const from = starsRef.current;
      if (clampedStars === from) return;
      const state = usePlannerStore.getState();
      const sheetOther = readSheetOther();
      const birth = state.birth;
      const next = birth
        ? sheetsFromBirth({
            birth,
            level: levelRef.current,
            stars: clampedStars,
            sheetOther,
            loadout: loadoutRef.current,
            tree: selectTreeSheetTotals(state),
          })
        : rescaleHeroForStars(
            nakedRef.current,
            gearedOverrideRef.current,
            loadoutRef.current,
            sheetOther,
            from,
            clampedStars,
          );
      setStarsStore(clampedStars);
      setNaked(next.naked);
      setGearedOverride(next.geared);
    },
    [setGearedOverride, setNaked, setStarsStore],
  );

  return {
    applyHero,
    changeLevel,
    changeStars,
    handleDeleteHero,
  };
}
