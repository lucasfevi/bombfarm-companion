'use client';

import { cn } from './cn';
import { Icon } from './icon';
import { Tooltip } from './tooltip';
import { infoTriggerClass } from './info-tip-trigger';

export interface InfoTipTooltipProps {
  label: string;
  tip: string;
  className?: string | undefined;
  /** The glyph was already hovered or focused before this loaded: open at once, keep the focus. */
  arrived?: 'hover' | 'focus' | undefined;
}

function restoreFocus(element: HTMLButtonElement | null) {
  element?.focus();
}

/**
 * The tooltip half of `InfoTip`. It is the only part that reaches `Tooltip`, and through it
 * `motion`, so `info-tip` loads it lazily and a page that merely renders a tip ships neither.
 */
export function InfoTipTooltip({ label, tip, className, arrived }: InfoTipTooltipProps) {
  return (
    <Tooltip.Provider delay={180} closeDelay={80}>
      <Tooltip.Root defaultOpen={arrived !== undefined}>
        <Tooltip.Trigger
          type="button"
          aria-label={`${label}: ${tip}`}
          className={cn(infoTriggerClass, className)}
          {...(arrived === 'focus' ? { ref: restoreFocus } : {})}
        >
          <Icon name="information-circle" size="xs" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0 max-w-72 text-[11px] leading-snug">{tip}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
