import { chestIconSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';

/**
 * The in-game item chest, on its own — same role as {@link GoldIcon} but for chests: it marks a
 * whole ROW/label as being about chests, and so belongs beside the row's label rather than
 * prefixing an inline number.
 */
export function ChestIcon({ className }: { className?: string }) {
  return (
    <img
      src={chestIconSrc()}
      alt=""
      aria-hidden
      className={cn('size-4 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
