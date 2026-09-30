'use client';

import { Fragment, type ReactNode } from 'react';
import { SLOTS, type EquippedItem, type Loadout, type Slot } from '@bombfarm/domain/gear';
import { slotsGridClass } from '@bombfarm/game-art';

export type SlotPatchHandler = (slot: Slot, patch: Partial<EquippedItem> | null) => void;

/** What a host's per-slot editor needs to draw one slot and report a patch back to it. */
export type GearSlotEditorSlotProps = {
  slot: Slot;
  equipped: EquippedItem | null | undefined;
  changed?: boolean | undefined;
  onPatch: SlotPatchHandler;
};

export type GearSlotEditorSlot = (editor: GearSlotEditorSlotProps) => ReactNode;

export function GearSlotsGrid({
  loadout,
  onPatchSlot,
  renderSlot,
  'aria-label': ariaLabel,
}: {
  loadout: Loadout;
  onPatchSlot: SlotPatchHandler;
  renderSlot: GearSlotEditorSlot;
  'aria-label': string;
}) {
  return (
    <div className={slotsGridClass} role="group" aria-label={ariaLabel}>
      {SLOTS.map((slot) => (
        <Fragment key={slot}>
          {renderSlot({ slot, equipped: loadout[slot], onPatch: onPatchSlot })}
        </Fragment>
      ))}
    </div>
  );
}
