import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { itemIconSrc, itemKindIconSrc, raritySlotPlateSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';
import { ArtFrame, type ArtFrameSize } from './art-frame';
import { iconMetaGlyphRecipe } from './game-art.recipe';

type Props = {
  item: InventoryViewItem;
  size?: ArtFrameSize;
  className?: string;
};

/**
 * One inventory item's art: the game's own rarity slot plate, the item sprite over it, and the
 * two glyphs the game itself draws on a gear tile — level top-right, forge bottom-right.
 *
 * Only gear carries those glyphs. A gem or a key has `level: 0` and `upgrade: 0` on the wire, so
 * drawing them would print a "0" on every stack.
 */
export function InventoryItemIcon({ item, size = 'xl', className }: Props) {
  const plate = raritySlotPlateSrc(item.rarityIdx);
  const icon = item.kind === 'equipment' ? itemIconSrc(item.defId) : itemKindIconSrc(item.defId, item.rarityIdx);
  const glyphSize = size === 'xs' || size === 'sm' ? 'compact' : 'roomy';
  const isGear = item.kind === 'equipment';
  const upgrade = Math.max(0, Math.round(item.upgrade));

  return (
    <ArtFrame
      rarityIdx={item.rarityIdx}
      size={size}
      shape="portrait"
      fill={plate ? 'plate' : 'rarity'}
      className={className}
    >
      {plate ? (
        <img src={plate} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" draggable={false} />
      ) : null}
      {icon ? (
        <img src={icon} alt="" className={cn('relative size-full object-contain', 'p-0.5')} draggable={false} />
      ) : (
        <span className="size-full" aria-hidden="true" />
      )}
      {isGear ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'top-end' })} aria-hidden="true">
          {Math.max(0, Math.round(item.level))}
        </span>
      ) : null}
      {isGear && upgrade > 0 ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'bottom-end' })} aria-hidden="true">
          +{upgrade}
        </span>
      ) : null}
    </ArtFrame>
  );
}
