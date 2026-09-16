'use client';

import type { ReactNode } from 'react';
import { itemValores, upgradeMult } from '@bombfarm/domain/gear';
import { itemName, itemRarityLabel, itemStatLabel, levelLabel, peekLabel } from '@bombfarm/domain/game-labels';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { cn, formatNumber } from '@bombfarm/ui';
import { rarityTextClass } from '../game-art.recipe';
import { GoldIcon } from '../gold-icon';
import {
  inventoryStatLabelClass,
  inventoryStatLeaderClass,
  inventoryStatRowClass,
  inventoryStatValueClass,
} from '../inventory-grid.recipe';
import { ItemIcon, type ItemIconItem } from '../item-icon';
import { MarketPrice, type MarketPriceLabels, type MarketPriceView } from '../market-price';
import { PeekFrame } from './peek-frame';
import {
  peekGoldClass,
  peekHeadClass,
  peekNameClass,
  peekNameTextClass,
  peekRowsClass,
  peekRuleClass,
  peekSubClass,
  peekValueRowClass,
} from './peek.recipe';

/** One stat line as the card prints it: the catalog's stat name, the roll as the game shows it. */
export type ItemPeekStat = {
  stat: string;
  valor: number;
  unit: 'flat' | 'pct';
};

/** The game's own rolls as an inventory row carries them — the shape `InventoryViewItem.stats` has. */
export type WireItemStat = { name: string | null; unit: 'flat' | 'pct'; effective: number };

/** The Steam Community Market quote for the item, with the host's own words for it. */
export type ItemPeekPrice = { view: MarketPriceView; labels: MarketPriceLabels };

/**
 * An inventory row as the card reads it: the same item, its rolls turned into stat lines. A roll
 * whose stat the catalog does not know is dropped — the card has no label for it.
 */
export function itemPeekFromInventory(
  item: ItemIconItem & {
    count?: number | undefined;
    sellValueGold?: number | undefined;
    stats?: readonly WireItemStat[] | undefined;
  },
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
  /** What the game pays for one of it. Absent on a piece the planner built from the catalog. */
  sellValueGold?: number | undefined;
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
  price?: ItemPeekPrice | undefined;
  children: ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
  stopRowActivation?: boolean | undefined;
};

function isGear(item: ItemPeekItem): boolean {
  return item.kind === undefined || item.kind === 'equipment';
}

function Dot() {
  return (
    <span className="text-muted" aria-hidden="true">
      ·
    </span>
  );
}

/** The card an item opens: name and forge, tier, level and forge multiplier, every stat it rolls, and what it is worth. */
export function ItemPeekCard({ item, lang, name, price }: Pick<ItemPeekProps, 'item' | 'lang' | 'name' | 'price'>) {
  const gear = isGear(item);
  const tier = rarityTextClass(item.rarityIdx) ?? 'text-ink';
  const title = name ?? (gear ? itemName(item, lang) : itemRarityLabel(item.rarityIdx, lang));
  const upgrade = gear ? Math.max(0, Math.round(item.upgrade)) : 0;
  const stats: readonly ItemPeekStat[] = gear ? (item.stats ?? itemValores(item)) : [];
  const count = item.count ?? 1;
  const gold = item.sellValueGold ?? 0;

  return (
    <div data-slot="item-peek">
      <div className={peekHeadClass}>
        <ItemIcon item={item} size="lg" className="shrink-0" />
        <div className="min-w-0">
          <div className={peekNameClass}>
            <span className={cn(peekNameTextClass, gear ? 'text-ink' : tier)}>{title}</span>
            {upgrade > 0 ? <span className="shrink-0 text-xs font-semibold text-accent">+{upgrade}</span> : null}
          </div>
          <div className={peekSubClass}>
            {gear ? (
              <>
                <span className={cn('font-semibold', tier)}>{itemRarityLabel(item.rarityIdx, lang)}</span>
                <Dot />
                <span className="text-muted">{levelLabel(item.level, lang)}</span>
                {upgrade > 0 ? (
                  <>
                    <Dot />
                    <span className="text-muted">
                      {peekLabel('forge', lang)} ×{formatNumber(upgradeMult(upgrade), lang, 2)}
                    </span>
                  </>
                ) : null}
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
              <span key={stat} className={cn(inventoryStatRowClass, 'text-[11px]')}>
                <span className={inventoryStatLabelClass}>{itemStatLabel(stat, lang)}</span>
                <span className={inventoryStatLeaderClass} aria-hidden="true" />
                <span className={inventoryStatValueClass}>
                  {unit === 'flat' ? `+${formatNumber(valor, lang, 1)}` : `+${formatNumber(valor * 100, lang, 2)}%`}
                </span>
              </span>
            ))}
          </div>
        </>
      ) : null}
      {gold > 0 || price ? (
        <>
          <div className={peekRuleClass} />
          <div className={peekValueRowClass}>
            {gold > 0 ? (
              <span data-slot="item-peek-gold" className={peekGoldClass}>
                <GoldIcon className="size-3.5" />
                {formatNumber(gold, lang, 0)}
              </span>
            ) : (
              <span />
            )}
            {price ? <MarketPrice price={price.view} labels={price.labels} className="text-[11px]" /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Wraps an item's icon (or name) so hovering it opens {@link ItemPeekCard}. */
export function ItemPeek({ item, lang, name, price, children, className, disabled, stopRowActivation }: ItemPeekProps) {
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
      card={<ItemPeekCard item={item} lang={lang} name={name} price={price} />}
    >
      {children}
    </PeekFrame>
  );
}
