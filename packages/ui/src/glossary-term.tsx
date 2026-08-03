'use client';

import { Tooltip } from './tooltip';
import { cn } from './cn';
import { glossaryTermTriggerClass } from './glossary-term.recipe';

export type GlossaryTermProps = {
  /** Visible token in the formula (e.g. `abl`). */
  children: string;
  /** Short definition shown in the tooltip. */
  tip: string;
  className?: string;
};

/**
 * Inline formula abbreviation with a dotted underline and animated Tooltip.
 * Prefer over always-on legend paragraphs for dense ledger formulas.
 */
export function GlossaryTerm({ children, tip, className }: GlossaryTermProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        delay={200}
        closeDelay={100}
        className={cn(glossaryTermTriggerClass, className)}
        aria-label={`${children}: ${tip}`}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0">
              <span className="font-semibold text-accent">{children}</span>
              <span className="text-muted"> — </span>
              <span>{tip}</span>
            </p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
