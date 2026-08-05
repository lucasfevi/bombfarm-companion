import type { EquippedItem } from '@bombfarm/domain/gear';
import { itemIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';
import { ArtFrame, type ArtFrameSize } from '@/shared/game-art/art-frame';
import { iconMetaGlyphRecipe } from '@/shared/game-art/game-art.recipe';

type Props = {
  equipped: EquippedItem;
  size?: ArtFrameSize;
  className?: string;
  /** Hide forge +N (upgrade still in tooltip). Default true. */
  showUpgrade?: boolean;
  /** Hide item-level glyph. Default true. */
  showLevel?: boolean;
};

export function ItemIcon({
  equipped,
  size = 'md',
  className,
  showUpgrade = true,
  showLevel = true,
}: Props) {
  const iconUrl = itemIconSrc(equipped.defId);
  const upgrade = Math.max(0, Math.round(equipped.upgrade));
  const level = Math.max(0, Math.round(equipped.level));
  const glyphSize = size === 'xs' || size === 'sm' ? 'compact' : 'roomy';
  const imgPad = size === 'xs' || size === 'sm' ? 'p-px' : 'p-0.5';

  return (
    <ArtFrame
      rarityIdx={equipped.rarityIdx}
      size={size}
      shape="portrait"
      fill="rarity"
      className={className}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className={cn('relative size-full object-contain', imgPad)}
          draggable={false}
        />
      ) : (
        <span className="size-full" aria-hidden="true" />
      )}
      {showLevel ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'top-end' })} aria-hidden="true">
          {level}
        </span>
      ) : null}
      {showUpgrade && upgrade > 0 ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'bottom-end' })} aria-hidden="true">
          +{upgrade}
        </span>
      ) : null}
    </ArtFrame>
  );
}
