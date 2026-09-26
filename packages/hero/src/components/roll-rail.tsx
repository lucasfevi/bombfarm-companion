import { cn } from '@bombfarm/ui';
import { railTintFor, type RollTint } from '../model';

const TINT_CLASS: Record<RollTint, string> = {
  low: 'bg-down',
  mid: 'bg-warn',
  high: 'bg-up',
};

/** Where one birth statistic landed in the window it was rolled from, as a filled bar. */
export function RollRail({
  percentile,
  trackClassName = 'bg-bg',
  className,
}: {
  /** 0–100. */
  percentile: number;
  trackClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn('block h-1 w-full overflow-hidden', trackClassName, className)} aria-hidden="true">
      <span className={cn('block h-full', TINT_CLASS[railTintFor(percentile)])} style={{ width: `${percentile}%` }} />
    </span>
  );
}
