import type { EquippedItem } from '@bombfarm/domain/gear';
import { itemIconSrc } from '@bombfarm/domain/wiki-assets';

import { ArtFrame, type ArtFrameSize } from '@/shared/game-art/art-frame';
import { forgeUpgradeBadgeClass } from '@/shared/game-art/game-art.recipe';

type Props = {
  equipped: EquippedItem;
  size?: ArtFrameSize;
  className?: string;
  /** Hide forge +N on compact roster rows (upgrade still in tooltip). Default true. */
  showUpgrade?: boolean;
};

export function ItemIcon({ equipped, size = 'md', className, showUpgrade = true }: Props) {
  const iconUrl = itemIconSrc(equipped.defId);
  const upgrade = Math.max(0, Math.round(equipped.upgrade));

  return (
    <ArtFrame rarityIdx={equipped.rarityIdx} size={size} className={className}>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="size-full object-contain p-0.5"
          draggable={false}
        />
      ) : (
        <span
          className="size-full bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]"
          aria-hidden="true"
        />
      )}
      {showUpgrade && upgrade > 0 ? (
        <span className={forgeUpgradeBadgeClass} aria-hidden="true">
          +{upgrade}
        </span>
      ) : null}
    </ArtFrame>
  );
}
