import { propIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';

type Props = {
  /** Prop name as it appears in `PROPS` (e.g. `gold_ore`) — doubles as the art filename. */
  name: string;
  className?: string;
};

/**
 * Prop art for a table cell that already prints the prop's label.
 * Decorative (`alt=""`): the name is the accessible text, the icon only repeats it.
 *
 * `size-4` matches the 16px line box a dense `text-xs` DataTable row is built on, but that
 * only keeps the row at its original height if the wrapper is a BLOCK-level `flex`. Inside an
 * `inline-flex` the wrapper sits on the text baseline and the image hangs below it, taking the
 * row from 29px to 33px — measured, not assumed. Both phase tables wrap it in
 * `<span className="flex items-center gap-1.5">` for that reason.
 */
export function PropIcon({ name, className }: Props) {
  const iconUrl = propIconSrc(name);
  if (!iconUrl) return null;

  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden
      className={cn('size-4 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
