import { dropIconSrc } from '@bombfarm/domain/wiki-assets';
import type { DropRateId } from '@bombfarm/domain/phase-wiki';

import { cn } from '@bombfarm/ui';

type Props = {
  /** Drop-chance row id (e.g. `time`) — `dropIconSrc` maps it to the bundled sprite. */
  id: DropRateId;
  className?: string;
};

/**
 * Drop art for a Drops-panel row that already prints the drop's label.
 * Decorative (`alt=""`): the label is the accessible text, the icon only repeats it.
 *
 * `size-3.5`, NOT the `size-4` the phase tables use for prop art — measured, not assumed. This
 * panel's rows are an 11px/14.85px line box, where the tables' cells are 12px/16px, so a 16px
 * image overflows and every row it lands on grows a pixel. At 14px the rows measure
 * byte-identical to their pre-icon height.
 *
 * Passed as `StatListItem.icon` rather than folded into `label`, which is what keeps the "yours"
 * rows from growing 4px and keeps the tooltip trigger's dotted underline under the words alone.
 */
export function DropIcon({ id, className }: Props) {
  const iconUrl = dropIconSrc(id);
  if (!iconUrl) return null;

  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden
      className={cn('size-3.5 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
