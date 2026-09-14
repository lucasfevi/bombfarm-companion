'use client';

import type { ReactNode } from 'react';
import { SLOTS, itemValores, type EquippedItem, type Loadout, type Slot } from '@bombfarm/domain/gear';
import { itemName, itemRarityLabel, slotLabel } from '@bombfarm/domain/game-labels';
import {
  ItemIcon,
  rarityTextClass,
  slotChromeClassName,
  slotStatRowClass,
  slotsGridClass,
} from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { sub, type GearPanelCopy, type Lang } from '../copy';

/** The four members of `GearPanelCopy` one slot card prints. */
export type GearSlotCardCopy = Pick<
  GearPanelCopy,
  'gearSlotEmptyAria' | 'gearSlotEmptyTip' | 'rankLv' | 'slotStatFullLabels'
>;

export type GearSlotCardProps = {
  slot: Slot;
  equipped: EquippedItem | null | undefined;
  lang: Lang;
  t: GearSlotCardCopy;
  formatNumber: (n: number, d?: number) => string;
  /** A clone slot that differs from the current gear. */
  changed?: boolean | undefined;
  /** A host's controls for the slot, drawn under the item. */
  children?: ReactNode;
};

const slotHeadClass = 'text-center text-[10px] leading-tight font-bold tracking-wider uppercase';
const emptyTileClass =
  'flex w-16 aspect-[18/19] max-[720px]:w-14 shrink-0 items-center justify-center rounded-sm border border-dashed border-line bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))] px-0.5';

/**
 * One gear slot, said the same way on every host: which slot it is, the item's art in its rarity
 * frame, the item's name, tier, level and forge, and the stats it contributes. A host that edits
 * the slot hands its controls in as children; one that only reads it hands nothing.
 */
export function GearSlotCard({ slot, equipped, lang, t, formatNumber, changed, children }: GearSlotCardProps) {
  const slotName = slotLabel(slot, lang);

  if (!equipped) {
    return (
      <div
        role="group"
        className={slotChromeClassName(equipped, changed)}
        data-gear-slot={slot}
        aria-label={sub(t.gearSlotEmptyAria, { slot: slotName })}
      >
        <b className={cn(slotHeadClass, 'text-muted')}>{slotName}</b>
        <div className="flex justify-center">
          <span className={emptyTileClass} aria-hidden="true" />
        </div>
        <p className="m-0 text-center text-xs text-muted">{t.gearSlotEmptyTip}</p>
        {children}
      </div>
    );
  }

  const tier = rarityTextClass(equipped.rarityIdx) ?? 'text-ink';
  const stats = itemValores(equipped);

  return (
    <div
      role="group"
      className={slotChromeClassName(equipped, changed)}
      data-gear-slot={slot}
      aria-label={slotName}
    >
      <b className={cn(slotHeadClass, 'text-muted')}>{slotName}</b>
      <div className="flex justify-center">
        <ItemIcon item={equipped} size="xl" className="shrink-0" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 text-center">
        <span className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1">
          <span className="min-w-0 text-sm font-semibold text-ink">{itemName(equipped, lang)}</span>
          {equipped.upgrade > 0 ? (
            <span className="shrink-0 text-sm font-semibold text-accent">+{equipped.upgrade}</span>
          ) : null}
        </span>
        <span className="flex min-w-0 items-baseline justify-center gap-1 text-xs leading-none">
          <span className={cn('shrink-0 font-medium', tier)}>{itemRarityLabel(equipped.rarityIdx, lang)}</span>
          <span className="shrink-0 text-muted" aria-hidden="true">
            &middot;
          </span>
          <span className="truncate text-muted">
            {t.rankLv} {equipped.level}
          </span>
        </span>
      </div>
      {stats.length > 0 ? (
        <div className="flex flex-col gap-0.5 text-[11px] leading-snug tabular-nums">
          {stats.map(({ stat, valor, unit }) => (
            <div key={stat} className={slotStatRowClass}>
              <span>{t.slotStatFullLabels[stat as keyof typeof t.slotStatFullLabels]}</span>
              <b>{unit === 'flat' ? `+${formatNumber(valor, 1)}` : `+${formatNumber(valor * 100, 1)}%`}</b>
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** The eight slots of one loadout as read-only cards — what a host with no slot editor draws. */
export function GearSlotCardsGrid({
  loadout,
  lang,
  t,
  formatNumber,
  'aria-label': ariaLabel,
}: {
  loadout: Loadout;
  lang: Lang;
  t: GearSlotCardCopy;
  formatNumber: (n: number, d?: number) => string;
  'aria-label': string;
}) {
  return (
    <div className={slotsGridClass} aria-label={ariaLabel}>
      {SLOTS.map((slot) => (
        <GearSlotCard
          key={slot}
          slot={slot}
          equipped={loadout[slot]}
          lang={lang}
          t={t}
          formatNumber={formatNumber}
        />
      ))}
    </div>
  );
}
