'use client';

import { SLOTS, itemValores, type Loadout } from '@bombfarm/domain/gear';
import { slotStatsGridClass, slotStatClassName, slotStatRowClass } from '@bombfarm/game-art';
import { mutedClass } from '@bombfarm/ui';
import type { GearPanelCopy } from '../copy';

export function GearSlotStatsGrid({
  loadout,
  t,
  formatNumber,
}: {
  loadout: Loadout;
  t: GearPanelCopy;
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
