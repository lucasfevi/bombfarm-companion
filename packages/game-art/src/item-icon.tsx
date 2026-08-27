import type { ItemKind } from '@bombfarm/domain/inventory-view';
import { itemIconSrc, itemKindIconSrc, raritySlotPlateSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';
import { ArtFrame, type ArtFrameSize } from './art-frame';
import { iconMetaGlyphRecipe } from './game-art.recipe';

/**
 * The fields an item tile draws. Deliberately structural rather than one of the domain's named
 * types: `EquippedItem` (a loadout slot) and `InventoryViewItem` (an inventory row) both satisfy
 * it, and they are the two shapes the app has for "an item you own".
 */
export type ItemIconItem = {
  defId: string;
  rarityIdx: number;
  level: number;
  upgrade: number;
  /** Absent means gear — that is what a loadout slot always holds. */
  kind?: ItemKind;
};

type Props = {
  item: ItemIconItem;
  size?: ArtFrameSize;
  className?: string;
  /** Hide the forge `+N` (it stays in the tooltip). Default: shown, on gear. */
  showUpgrade?: boolean;
  /** Hide the item-level glyph. Default: shown, on gear. */
  showLevel?: boolean;
};

/**
 * One item's tile, everywhere the app draws one: the gear slots in the planner, a hero's gear
 * strip, the team plan's proposed loadout, and the inventory grid. They were two components until
 * the inventory grew a version that laid the game's own rarity plate under the sprite; there is
 * only one of them now, because they answer the same question and a plate on three of four
 * surfaces is just an inconsistency.
 *
 * The plate is the game's own art. `fill="rarity"` — the hand-written CSS gradient that used to
 * approximate it — survives only as the fallback for a rarity index the plates do not cover.
 *
 * Level and forge are gear's glyphs alone: a gem or a key arrives with both at 0 on the wire, so
 * drawing them would print a "0" on every stack.
 */
export function ItemIcon({ item, size = 'md', className, showUpgrade, showLevel }: Props) {
  const isGear = item.kind === undefined || item.kind === 'equipment';
  const plate = raritySlotPlateSrc(item.rarityIdx);
  const iconUrl = isGear ? itemIconSrc(item.defId) : itemKindIconSrc(item.defId, item.rarityIdx);

  const glyphSize = size === 'xs' || size === 'sm' ? 'compact' : 'roomy';
  const imgPad = size === 'xs' || size === 'sm' ? 'p-px' : 'p-0.5';
  const upgrade = Math.max(0, Math.round(item.upgrade));
  const withLevel = (showLevel ?? true) && isGear;
  const withUpgrade = (showUpgrade ?? true) && isGear && upgrade > 0;

  return (
    <ArtFrame
      rarityIdx={item.rarityIdx}
      size={size}
      shape="portrait"
      fill={plate ? 'plate' : 'rarity'}
      className={className}
    >
      {plate ? (
        <img
          src={plate}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
      ) : null}
      {iconUrl ? (
        <img src={iconUrl} alt="" className={cn('relative size-full object-contain', imgPad)} draggable={false} />
      ) : (
        <span className="size-full" aria-hidden="true" />
      )}
      {withLevel ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'top-end' })} aria-hidden="true">
          {Math.max(0, Math.round(item.level))}
        </span>
      ) : null}
      {withUpgrade ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'bottom-end' })} aria-hidden="true">
          +{upgrade}
        </span>
      ) : null}
    </ArtFrame>
  );
}
