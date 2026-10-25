'use client';

import { lazy, Suspense, useState } from 'react';
import { cn } from './cn';
import { Icon } from './icon';
import { infoTriggerClass } from './info-tip-trigger';

const InfoTipTooltip = lazy(() =>
  import('./info-tip-tooltip').then((module) => ({ default: module.InfoTipTooltip })),
);

/**
 * A bare info glyph that carries a sentence on hover or focus — drawn beside a panel title or a
 * field label in place of an intro paragraph, so the panel stays as tall as its content. Carries its
 * own `Tooltip.Provider`, so it works anywhere.
 *
 * The tooltip loads lazily, the way `AppNav`'s does: until it arrives the glyph is the same
 * `<button>` with the same accessible name, so the first paint and the markup do not change, and a
 * page that only renders a tip does not ship `motion` in its first load. A glyph hovered or focused
 * before the tooltip arrives is not lost: the tooltip opens as soon as it does, and focus carries over.
 */
export function InfoTip({ label, tip, className }: { label: string; tip: string; className?: string }) {
  const [arrived, setArrived] = useState<'hover' | 'focus' | undefined>(undefined);

  return (
    <Suspense
      fallback={
        <button
          type="button"
          data-base-ui-tooltip-trigger=""
          data-slot="tooltip-trigger"
          aria-label={`${label}: ${tip}`}
          className={cn(infoTriggerClass, className)}
          onMouseEnter={() => {
            setArrived((current) => current ?? 'hover');
          }}
          onMouseLeave={() => {
            setArrived((current) => (current === 'hover' ? undefined : current));
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(':focus-visible')) setArrived('focus');
          }}
          onBlur={() => {
            setArrived(undefined);
          }}
        >
          <Icon name="information-circle" size="xs" />
        </button>
      }
    >
      <InfoTipTooltip label={label} tip={tip} className={className} arrived={arrived} />
    </Suspense>
  );
}
