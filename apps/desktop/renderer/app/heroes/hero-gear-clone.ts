import type { EquippedItem, Loadout, Slot } from '@bombfarm/domain/gear';
import { patchSlot } from '@bombfarm/domain/loadout';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

export type GearClones = Readonly<Record<string, Loadout>>;

export const NO_GEAR_CLONES: GearClones = {};

export function copyGearClone(clones: GearClones, heroId: string, current: Loadout): GearClones {
  return { ...clones, [heroId]: structuredClone(current) };
}

export function patchGearClone(
  clones: GearClones,
  heroId: string,
  slot: Slot,
  patch: Partial<EquippedItem> | null,
): GearClones {
  const clone = clones[heroId];
  if (!clone) return clones;
  return { ...clones, [heroId]: patchSlot(clone, slot, patch) };
}

export function clearGearClone(clones: GearClones, heroId: string): GearClones {
  if (!(heroId in clones)) return clones;
  const { [heroId]: _removed, ...rest } = clones;
  return rest;
}

export function heroWithGearClone(hero: HeroRecord, clones: GearClones): HeroRecord {
  const clone = clones[hero.id];
  return clone ? { ...hero, altLoadout: clone } : hero;
}
