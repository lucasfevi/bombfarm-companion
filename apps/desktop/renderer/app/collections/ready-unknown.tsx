'use client';

import { Tooltip } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';

/** Stands where a ready count would be while the bag has not been read, so "unknown" never reads
 *  as "nothing is ready". */
export function ReadyUnknown() {
  const t = useCopy();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span />}
        role="img"
        aria-label={t.collectionsFilterReadyUnavailable}
        tabIndex={-1}
        data-testid="collections-ready-unknown"
        className="cursor-help text-muted"
      >
        {t.collectionsReadyUnknownMark}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-64 text-[11px] leading-snug">{t.collectionsFilterReadyUnavailable}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
