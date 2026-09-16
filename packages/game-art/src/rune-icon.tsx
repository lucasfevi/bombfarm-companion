import type { RuneAxis } from '@bombfarm/domain/runes';
import { raritySlotPlateSrc, runeIconSrc } from '@bombfarm/domain/wiki-assets';
import { ArtFrame, type ArtFrameSize } from './art-frame';

type Props = {
  axis: RuneAxis;
  rarityIdx: number;
  size?: ArtFrameSize;
  className?: string;
};

/**
 * One rune's tile: the game's sprite for its axis and rarity, on the same rarity plate an item
 * sits on — the wiki draws them that way, and a rune is a consumable the player holds, not a stat.
 */
export function RuneIcon({ axis, rarityIdx, size = 'md', className }: Props) {
  const plate = raritySlotPlateSrc(rarityIdx);
  const iconUrl = runeIconSrc(axis, rarityIdx);

  return (
    <ArtFrame rarityIdx={rarityIdx} size={size} fill={plate ? 'plate' : 'rarity'} className={className}>
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
        <img
          src={iconUrl}
          alt=""
          className="absolute inset-0 size-full object-contain p-0.5"
          draggable={false}
        />
      ) : null}
    </ArtFrame>
  );
}
