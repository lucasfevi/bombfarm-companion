import { houseIconSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';

/**
 * The House itself, by 0-based Casa index. Same five sprites the Farm board's time-drop row
 * uses — the game draws one House per rarity tier, and the Casas run through those same tiers.
 */
export function HouseIcon({ houseIdx, className }: { houseIdx: number; className?: string }) {
  return (
    <img
      src={houseIconSrc(houseIdx)}
      alt=""
      aria-hidden
      className={cn('size-5 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
