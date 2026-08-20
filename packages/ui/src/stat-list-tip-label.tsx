'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';
import { Tooltip } from './tooltip';
import { glossaryTermTriggerClass } from './glossary-term.recipe';

export type TipLabelProps = { label: ReactNode; tip: string };

export function TipLabel({ label, tip }: TipLabelProps) {
  const aria =
    typeof label === 'string' || typeof label === 'number' ? `${label}: ${tip}` : tip;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        delay={180}
        closeDelay={80}
        className={cn(
          glossaryTermTriggerClass,
          'font-normal text-muted hover:text-ink',
        )}
        aria-label={aria}
      >
        {label}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-56 text-[11px] leading-snug">{tip}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
