import { dropIconSrc } from '@bombfarm/domain/wiki-assets';
import type { DropRateId } from '@bombfarm/domain/phase-wiki';

import { cn } from '@bombfarm/ui';

type Props = {
  /** Drop-chance row id (e.g. `time`) — `dropIconSrc` maps it to the bundled sprite. */
  id: DropRateId;
  /** Difficulty band of the phase being shown; four of the five sprites are drawn per band. */
  ato: number;
  className?: string;
};

/**
 * Drop art for a Drops-panel row that already prints the drop's label.
 * Decorative (`alt=""`): the label is the accessible text, the icon only repeats it.
 *
 * `size-8` (32px) deliberately overflows this panel's 11px/14.85px line box. That is far bigger
 * than the phase tables' prop art, and it is the point: these are detailed chests, and at the
 * 14px that fitted the line box exactly they were an unreadable smudge rather than something to
 * match a row against.
 *
 * What pays for it is the row MERGE, not slack alone. Collapsing each drop's wiki/yours pair into
 * one row halved the list, so a gate phase now prints four rows where it printed eight — and the
 * Drops panel's height is set by the board grid rather than by its content. Measured in the
 * browser: the panel stays at its grid height and nothing on the board moves.
 *
 * Passed as `StatListItem.icon` rather than folded into `label`, which is what keeps the tooltip
 * trigger's dotted underline under the words alone and off the sprite.
 */
export function DropIcon({ id, ato, className }: Props) {
  const iconUrl = dropIconSrc(id, ato);
  if (!iconUrl) return null;

  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden
      className={cn('size-8 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
