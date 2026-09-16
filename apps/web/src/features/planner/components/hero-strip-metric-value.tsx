'use client';

import { Tooltip } from '@bombfarm/ui';

/**
 * A compact metric whose exact figure shows in a themed tooltip on hover — the pattern
 * `AbbreviatedNumber` uses, replacing the native `title` this cell used to carry. Relies on an
 * ancestor `Tooltip.Provider` (the metrics rail supplies one).
 */
export function MetricValue({
  compact,
  full,
  className,
}: {
  compact: string;
  full: string;
  className?: string;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<strong className={className} />}>{compact}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 font-mono">{full}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
