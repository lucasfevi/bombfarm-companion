import {
  SLOTS,
  defsForSlot,
  setsForLevel,
  emptySheetOther,
  projectGearedOntoLoadout,
  type EquippedItem,
  type Loadout,
  type SheetOtherPct,
  type SheetStats,
  type Slot,
} from './gear';

/** Pure slot patcher shared by the main loadout and the compare clone. */
export function patchSlot(previous: Loadout, slot: Slot, patch: Partial<EquippedItem> | null): Loadout {
  if (patch === null) return { ...previous, [slot]: null };
  const current = previous[slot];
  const level = patch.level ?? current?.level ?? 10;
  const sets = setsForLevel(level);
  const defId =
    patch.defId ?? current?.defId ?? defsForSlot(slot, sets[0])[0]?.id ?? defsForSlot(slot)[0]?.id ?? '';
  return {
    ...previous,
    [slot]: {
      defId,
      rarityIdx: patch.rarityIdx ?? current?.rarityIdx ?? 0,
      level,
      upgrade: patch.upgrade ?? current?.upgrade ?? 0,
    },
  };
}

export function itemsEqual(
  left: EquippedItem | null | undefined,
  right: EquippedItem | null | undefined,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.defId === right.defId &&
    left.rarityIdx === right.rarityIdx &&
    left.level === right.level &&
    left.upgrade === right.upgrade
  );
}

export function loadoutsEqual(left: Loadout, right: Loadout): boolean {
  return SLOTS.every((slot) => itemsEqual(left[slot], right[slot]));
}

/**
 * When the player changes current gear, treat the new loadout as equipped:
 * keep the sheet-implied naked fixed and re-apply the new bonuses
 * (same math as gear-compare projection).
 */
export function gearedAfterLoadoutChange(
  geared: SheetStats,
  from: Loadout,
  toLoadout: Loadout,
  other: SheetOtherPct = emptySheetOther(),
): SheetStats {
  if (loadoutsEqual(from, toLoadout)) return geared;
  return projectGearedOntoLoadout(geared, from, toLoadout, other);
}
