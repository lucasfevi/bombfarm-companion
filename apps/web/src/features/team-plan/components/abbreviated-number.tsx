'use client';

import { Tooltip, cn } from '@bombfarm/ui';
import { rosterIconTooltipTriggerClass } from '@/shared/game-art';
import { formatCompactNumber, formatNumber, type Lang } from '@/shared/lib/format-number';

/**
 * A `formatCompactNumber` value whose exact figure shows in a themed tooltip on hover/focus.
 * `disableFocus` drops it out of tab order for uses nested inside another interactive control
 * (e.g. an Accordion row trigger) — mirrors `HeroGearIcons`' own icon-tooltip convention.
 */
export function AbbreviatedNumber({
  value,
  lang,
  decimals = 1,
  signed = false,
  disableFocus = false,
  className,
}: {
  value: number;
  lang: Lang;
  decimals?: number;
  signed?: boolean;
  disableFocus?: boolean;
  className?: string;
}) {
  const sign = signed && value >= 0 ? '+' : '';
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span />}
        tabIndex={disableFocus ? -1 : undefined}
        className={cn(rosterIconTooltipTriggerClass, className)}
      >
        {sign}
        {formatCompactNumber(value, lang, decimals)}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 font-mono">
              {sign}
              {formatNumber(value, lang, 0)}
            </p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
