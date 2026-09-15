'use client';

import { cn } from './cn';
import { Icon } from './icon';
import { Tooltip } from './tooltip';

const infoTriggerClass =
  'inline-flex cursor-help items-center border-0 bg-transparent p-0 text-muted hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * A bare info glyph that carries a sentence on hover or focus — drawn beside a panel title or a
 * field label in place of an intro paragraph, so the panel stays as tall as its content. Needs a
 * `Tooltip.Provider` above it.
 */
export function InfoTip({ label, tip, className }: { label: string; tip: string; className?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger type="button" aria-label={`${label}: ${tip}`} className={cn(infoTriggerClass, className)}>
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
  );
}
