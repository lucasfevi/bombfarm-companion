'use client';

import { SLOTS, type Loadout } from '@bombfarm/domain/gear';
import type { Lang, Strings } from '@/shared/i18n';
import { SlotEditor, slotsGridClass, type SlotPatchHandler } from '@/features/gear';

export function GearSlotsGrid({
  loadout,
  t,
  lang,
  onPatchSlot,
}: {
  loadout: Loadout;
  t: Strings;
  lang: Lang;
  onPatchSlot: SlotPatchHandler;
}) {
  return (
    <div className={slotsGridClass}>
      {SLOTS.map((slot) => (
        <SlotEditor key={slot} slot={slot} equipped={loadout[slot]} t={t} lang={lang} onPatch={onPatchSlot} />
      ))}
    </div>
  );
}
