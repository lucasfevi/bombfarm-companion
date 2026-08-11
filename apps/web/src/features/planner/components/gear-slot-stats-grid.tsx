'use client';

import { SLOTS, itemValores, type Loadout } from '@bombfarm/domain/gear';
import type { Strings } from '@/shared/i18n';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { slotStatsGridClass, slotStatClassName, slotStatRowClass } from '@/features/gear';

export function GearSlotStatsGrid({
  loadout,
  t,
  formatNumber,
}: {
  loadout: Loadout;
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
}) {
  return (
    <div className={slotStatsGridClass} aria-label={t.slotStats}>
      {SLOTS.map((slot) => {
        const equipped = loadout[slot];
        const vals = equipped ? itemValores(equipped) : [];
        return (
          <div key={slot} className={slotStatClassName(equipped)}>
            {vals.length === 0 ? (
              <span className={mutedClass}>—</span>
            ) : (
              vals.map(({ stat, valor, unit }) => (
                <div key={stat} className={slotStatRowClass}>
                  <span>{t.slotStatFullLabels[stat as keyof typeof t.slotStatFullLabels]}</span>
                  <b>{unit === 'flat' ? `+${formatNumber(valor, 1)}` : `+${formatNumber(valor * 100, 1)}%`}</b>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
