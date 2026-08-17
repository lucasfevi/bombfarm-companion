'use client';

import { useCallback, useRef } from 'react';
import { sheetsFromBirth } from '@bombfarm/domain/birth-sheet';
import {
  ABILITIES,
  ABILITY_LEVEL_MAX,
  abilityMods,
  abilityPointBudget,
  isSheetAbility,
} from '@bombfarm/domain/model';
import {
  emptyLoadout,
  nakedAfterSheetAbilityChange,
  rescaleNakedCritDmg,
  rescaleNakedPen,
  type Loadout,
  type Slot,
  type EquippedItem,
} from '@bombfarm/domain/gear';
import { gearedAfterLoadoutChange, loadoutsEqual, patchSlot } from '@bombfarm/domain/loadout';
import { resetHeroAbilities } from '@bombfarm/domain/hero-abilities';
import { usePlannerStore, selectAdvisorPipeline, selectTreeSheetTotals } from '@/shared/stores';

function syncGearedAfterLoadout(
  previous: Loadout,
  next: Loadout,
  sheetOther: ReturnType<typeof selectAdvisorPipeline>['sheetOther'],
): void {
  const state = usePlannerStore.getState();
  const birth = state.birth;
  if (birth) {
    const { naked, geared } = sheetsFromBirth({
      birth,
      level: state.level,
      stars: state.stars,
      sheetOther,
      loadout: next,
      tree: selectTreeSheetTotals(state),
    });
    state.setNaked(naked);
    state.setGearedOverride(geared);
    return;
  }
  state.setGearedOverride(
    gearedAfterLoadoutChange(state.gearedOverride, previous, next, sheetOther),
  );
}

export function useHeroBuildActions() {
  const abilities = usePlannerStore((state) => state.abilities);
  const setAbilities = usePlannerStore((state) => state.setAbilities);
  const loadout = usePlannerStore((state) => state.loadout);
  const setLoadout = usePlannerStore((state) => state.setLoadout);
  const setAltLoadout = usePlannerStore((state) => state.setAltLoadout);
  const setGearedOverride = usePlannerStore((state) => state.setGearedOverride);
  const naked = usePlannerStore((state) => state.naked);
  const setNaked = usePlannerStore((state) => state.setNaked);
  const rarity = usePlannerStore((state) => state.rarity);
  const level = usePlannerStore((state) => state.level);

  const abilityPointsSpent = Object.values(abilities).reduce((sum, points) => sum + (points || 0), 0);
  const abilityPointsMax = abilityPointBudget(rarity, level);

  const loadoutRef = useRef(loadout);
  loadoutRef.current = loadout;
  const nakedRef = useRef(naked);
  nakedRef.current = naked;

  const readSheetOther = () => selectAdvisorPipeline(usePlannerStore.getState()).sheetOther;

  const setAbilityLevel = useCallback(
    (abilityId: string, next: number) => {
      const current = abilities[abilityId] ?? 0;
      const ability = ABILITIES.find((candidate) => candidate.id === abilityId);
      const maxLv = ability?.max ?? ABILITY_LEVEL_MAX;
      const clamped = Math.max(0, Math.min(maxLv, next));
      if (clamped === current) return;
      if (!(abilityId in abilities)) return;
      const others = abilityPointsSpent - current;
      const room = Math.max(0, abilityPointsMax - others);
      const capped = Math.min(clamped, room);
      let nextAbilities: Record<string, number>;
      if (capped <= 0) {
        if (current <= 0) return;
        nextAbilities = { ...abilities, [abilityId]: 0 };
      } else {
        nextAbilities = { ...abilities, [abilityId]: capped };
      }
      setAbilities(nextAbilities);
      if (ability && isSheetAbility(ability)) {
        const prevMods = abilityMods(abilities);
        const nextMods = abilityMods(nextAbilities);
        // DEC-04/BSP-31a: the crit-chance path now rescales by the sheet-ability ratio
        // (rescaleNakedCritChance, via the dispatcher) — never the rarity-midpoint reset
        // rescaleNakedCrit used to apply. penetrationPp / critDmgFlat are unaffected;
        // the dispatcher returns naked unchanged for every other kind, matching the old
        // no-op fallthrough.
        setNaked(nakedAfterSheetAbilityChange(nakedRef.current, ability.effect.kind, prevMods, nextMods));
      }
    },
    [abilities, abilityPointsMax, abilityPointsSpent, setAbilities, setNaked],
  );

  const setSlot = useCallback(
    (slot: Slot, patch: Partial<EquippedItem> | null) => {
      const previous = loadoutRef.current;
      const next = patchSlot(previous, slot, patch);
      if (loadoutsEqual(previous, next)) return;
      setLoadout(next);
      syncGearedAfterLoadout(previous, next, readSheetOther());
    },
    [setLoadout],
  );

  const setAltSlot = useCallback(
    (slot: Slot, patch: Partial<EquippedItem> | null) => {
      const previous = usePlannerStore.getState().altLoadout;
      setAltLoadout(patchSlot(previous ?? emptyLoadout(), slot, patch));
    },
    [setAltLoadout],
  );

  const resetAbilities = useCallback(() => {
    const previous = usePlannerStore.getState().abilities;
    const next = resetHeroAbilities(previous);
    const prevMods = abilityMods(previous);
    const nextMods = abilityMods(next);
    // DEC-04/BSP-31a: same dispatcher as setAbilityLevel — preserves the hero's own crit roll
    // instead of resetting it to the rarity midpoint.
    if (prevMods.sheetCritChanceFlat !== nextMods.sheetCritChanceFlat) {
      setNaked(nakedAfterSheetAbilityChange(nakedRef.current, 'critChanceFlat', prevMods, nextMods));
    }
    if (prevMods.sheetPenetrationRaw !== nextMods.sheetPenetrationRaw) {
      setNaked(rescaleNakedPen(nakedRef.current, prevMods.sheetPenetrationRaw, nextMods.sheetPenetrationRaw));
    }
    if (prevMods.sheetCritDmgFlat !== nextMods.sheetCritDmgFlat) {
      setNaked(rescaleNakedCritDmg(nakedRef.current, prevMods.sheetCritDmgFlat, nextMods.sheetCritDmgFlat));
    }
    setAbilities(next);
  }, [setAbilities, setNaked]);

  const clearCompare = useCallback(() => {
    setAltLoadout(null);
  }, [setAltLoadout]);

  const copyGear = useCallback(() => {
    setAltLoadout(JSON.parse(JSON.stringify(loadoutRef.current)) as Loadout);
  }, [setAltLoadout]);

  const applyAltGear = useCallback(() => {
    const alt = usePlannerStore.getState().altLoadout;
    if (!alt) return;
    const previous = loadoutRef.current;
    const next = JSON.parse(JSON.stringify(alt)) as Loadout;
    if (loadoutsEqual(previous, next)) return;
    setLoadout(next);
    syncGearedAfterLoadout(previous, next, readSheetOther());
  }, [setLoadout]);

  return {
    setAbilityLevel,
    setSlot,
    setAltSlot,
    resetAbilities,
    clearCompare,
    copyGear,
    applyAltGear,
    setGearedOverride,
  };
}
