import type { ReactNode } from 'react';
import { goldIconSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';

/**
 * Gold amount with the in-game coin icon prefixed.
 *
 * `baseline` is for a figure that appears inside a sentence. A flex container whose items are all
 * centred has no baseline of its own, so the browser synthesises one from the box's bottom edge
 * and the whole chunk rides above the words beside it — measured at 2.6px on an 11px line and
 * 2.9px on a 12px one. Letting the number be the one item that aligns on a baseline hands that
 * baseline to the container, and the figure sits on the sentence's line. The coin stays centred:
 * it is shorter than the number's line box everywhere this renders.
 *
 * It is opt-in because the synthesised baseline also props a table row open. Turning it on for
 * the right-aligned cells leaves the figure itself where it was to the pixel — same coin, same
 * number, same right edge — but takes 3px of leading out of every row that holds one.
 */
export function GoldValue({
  children,
  className,
  iconClassName,
  baseline = false,
}: {
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  baseline?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center justify-end gap-1', className)}>
      <img
        src={goldIconSrc()}
        alt=""
        aria-hidden
        className={cn('size-3.5 shrink-0 object-contain', iconClassName)}
      />
      <span className={baseline ? 'self-baseline' : undefined}>{children}</span>
    </span>
  );
}
