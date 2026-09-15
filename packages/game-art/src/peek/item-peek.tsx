'use client';

import type { ReactNode } from 'react';
import { itemValores, upgradeMult, type Slot } from '@bombfarm/domain/gear';
import {
  itemName,
  itemRarityLabel,
  itemSetName,
  itemSlot,
  itemStatLabel,
  levelLabel,
  peekLabel,
  slotLabel,
} from '@bombfarm/domain/game-labels';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { cn, formatNumber } from '@bombfarm/ui';
import { rarityTextClass } from '../game-art.recipe';
import { ItemIcon, type ItemIconItem } from '../item-icon';
import { PeekFrame } from './peek-frame';
import {
  peekFootClass,
  peekHeadClass,
  peekNameClass,
  peekNameTextClass,
  peekRowClass,
  peekRowsClass,
  peekRuleClass,
  peekSubClass,
} from './peek.recipe';

/** One stat line as the card prints it: the catalog's stat name, the roll as the game shows it. */
export type ItemPeekStat = {
  stat: string;
  valor: number;
  unit: 'flat' | 'pct';
};

/** The game's own rolls as an inventory row carries them — the shape `InventoryViewItem.stats` has. */
export type WireItemStat = { name: string | null; unit: 'flat' | 'pct'; effective: number };

/**
 * An inventory row as the card reads it: the same item, its rolls turned into stat lines. A roll
 * whose stat the catalog does not know is dropped — the card has no label for it.
 */
export function itemPeekFromInventory(
  item: ItemIconItem & { count?: number | undefined; stats?: readonly WireItemStat[] | undefined },
): ItemPeekItem {
  const { stats, ...rest } = item;
  if (!stats) return rest;
  return {
    ...rest,
    stats: stats.flatMap((stat) => (stat.name ? [{ stat: stat.name, valor: stat.effective, unit: stat.unit }] : [])),
  };
}

export type ItemPeekItem = ItemIconItem & {
  /** A stack's size — a gem, a key. Absent or 1 on gear. */
  count?: number | undefined;
  /**
   * The rolls the game itself reported for this item, forge applied. Absent, the card derives
   * them from the catalog at the item's level and forge — right for a piece the planner built,
   * but an inventory row carries the game's own figures, and the card beside it prints those, so
   * the two must not disagree on a screen where both are visible.
   */
  stats?: readonly ItemPeekStat[] | undefined;
};

export type ItemPeekProps = {
  item: ItemPeekItem;
  lang: Lang;
  /**
   * The name a stackable kind goes by — a gem, a chest — which only the host's own dictionary
   * knows. Gear names itself from the catalog and needs none.
   */
  name?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
  stopRowActivation?: boolean | undefined;
};

function isGear(item: ItemPeekItem): boolean {
  return item.kind === undefined || item.kind === 'equipment';
}

/** The card an item opens: name and forge, tier and level, every stat it rolls, and where it goes. */
export function ItemPeekCard({ item, lang, name }: Pick<ItemPeekProps, 'item' | 'lang' | 'name'>) {
  const gear = isGear(item);
  const tier = rarityTextClass(item.rarityIdx) ?? 'text-ink';
  const title = name ?? (gear ? itemName(item, lang) : itemRarityLabel(item.rarityIdx, lang));
  const upgrade = gear ? Math.max(0, Math.round(item.upgrade)) : 0;
  const stats: readonly ItemPeekStat[] = gear ? (item.stats ?? itemValores(item)) : [];
  const slot: Slot | null = gear ? itemSlot(item) : null;
  const count = item.count ?? 1;

  return (
    <div data-slot="item-peek">
      <div className={peekHeadClass}>
        <ItemIcon item={item} size="lg" className="shrink-0" />
        <div className="min-w-0">
          <div className={peekNameClass}>
            <span className={cn(peekNameTextClass, tier)}>{title}</span>
            {upgrade > 0 ? <span className="shrink-0 text-xs font-semibold text-accent">+{upgrade}</span> : null}
          </div>
          <div className={peekSubClass}>
            {gear ? (
              <>
                <span className={cn('font-semibold', tier)}>{itemRarityLabel(item.rarityIdx, lang)}</span>
                <span className="text-muted" aria-hidden="true">
                  ·
                </span>
                <span className="text-muted">{levelLabel(item.level, lang)}</span>
              </>
            ) : count > 1 ? (
              <span className="text-muted">×{formatNumber(count, lang, 0)}</span>
            ) : null}
          </div>
        </div>
      </div>
      {stats.length > 0 ? (
        <>
          <div className={peekRuleClass} />
          <div className={peekRowsClass}>
            {stats.map(({ stat, valor, unit }) => (
              <div key={stat} className={peekRowClass}>
                <span>{itemStatLabel(stat, lang)}</span>
                <b>{unit === 'flat' ? `+${formatNumber(valor, lang, 1)}` : `+${formatNumber(valor * 100, lang, 2)}%`}</b>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {gear && slot ? (
        <div className={peekFootClass}>
          <span className="min-w-0 truncate">
            {slotLabel(slot, lang)} · {itemSetName(item, lang)}
          </span>
          {upgrade > 0 ? (
            <span className="shrink-0">
              {peekLabel('forge', lang)} ×{formatNumber(upgradeMult(upgrade), lang, 2)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Wraps an item's icon (or name) so hovering it opens {@link ItemPeekCard}. */
export function ItemPeek({ item, lang, name, children, className, disabled, stopRowActivation }: ItemPeekProps) {
  const gear = isGear(item);
  const title = name ?? (gear ? itemName(item, lang) : itemRarityLabel(item.rarityIdx, lang));
  const upgrade = gear && item.upgrade > 0 ? ` +${Math.round(item.upgrade)}` : '';
  const label = gear
    ? `${title}${upgrade}. ${levelLabel(item.level, lang)} ${itemRarityLabel(item.rarityIdx, lang)}`
    : title;
  return (
    <PeekFrame
      kind="item"
      label={label}
      className={className}
      disabled={disabled}
      stopRowActivation={stopRowActivation}
      card={<ItemPeekCard item={item} lang={lang} name={name} />}
    >
      {children}
    </PeekFrame>
  );
}
