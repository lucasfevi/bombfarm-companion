import { goldIconSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';

/**
 * The in-game coin, on its own.
 *
 * Split out from {@link GoldValue} rather than reusing it, because the two answer different
 * questions. `GoldValue` prefixes a coin to a NUMBER and is right wherever a gold figure appears
 * inline among non-gold ones — the prop table's two gold columns, the respec cards. This marks a
 * whole ROW as being about gold, and so belongs beside the row's label, in `StatListItem.icon`.
 *
 * Keeping `GoldValue` untouched matters: it still renders in four other surfaces, and widening it
 * with an "icon only, no children" mode would have made every one of those call sites carry a
 * variant they never use.
 */
export function GoldIcon({ className }: { className?: string }) {
  return (
    <img
      src={goldIconSrc()}
      alt=""
      aria-hidden
      className={cn('size-4 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
