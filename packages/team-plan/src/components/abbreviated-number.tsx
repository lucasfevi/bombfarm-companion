'use client';

import { Tooltip, cn } from '@bombfarm/ui';
import { rosterIconTooltipTriggerClass } from '@bombfarm/game-art';
import type { Lang } from '@bombfarm/hero/copy';
import { formatObjectiveFigure, type ObjectiveFigurePrecision } from '../model/objective-figure';

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
  precision = 'compact',
  disableFocus = false,
  className,
}: {
  value: number;
  lang: Lang;
  decimals?: number;
  signed?: boolean;
  precision?: ObjectiveFigurePrecision;
  disableFocus?: boolean;
  className?: string;
}) {
  const { shown, exact } = formatObjectiveFigure(value, lang, precision, { signed, decimals });
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span />}
        tabIndex={disableFocus ? -1 : undefined}
        className={cn(rosterIconTooltipTriggerClass, className)}
      >
        {shown}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 font-mono">{exact}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
