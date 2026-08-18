'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';
import { Tooltip } from './tooltip';
import { phasesStatListClass, statListClass } from './panel-field.recipe';
import { TipLabel } from './stat-list-tip-label';

export type StatListItem = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  /** Extra detail shown as a tooltip on the label (not an under-value line). */
  tip?: string;
  /**
   * Decorative art shown before the label. Deliberately a sibling of the label rather than part
   * of it, because with a `tip` the label becomes the tooltip TRIGGER: art folded into the label
   * would sit inside that trigger and take the trigger's dotted underline with it, which reads as
   * "hover this picture" and widens the hover target past the words it belongs to.
   */
  icon?: ReactNode;
};

export function StatList({
  items,
  className,
  variant = 'default',
  'aria-label': ariaLabel,
}: {
  items: StatListItem[];
  className?: string;
  variant?: 'default' | 'phases';
  'aria-label'?: string;
}) {
  const baseClass = variant === 'phases' ? phasesStatListClass : statListClass;
  const hasTips = items.some((item) => Boolean(item.tip));

  const list = (
    <dl className={cn(baseClass, className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const label = item.tip ? <TipLabel label={item.label} tip={item.tip} /> : item.label;
        return (
          <div key={item.id}>
            <dt>
              {item.icon ? (
                // BLOCK-level flex, not `inline-flex`: an inline-flex wrapper sits on the text
                // baseline and lets the art hang below it, growing every row it appears on.
                <span className="flex items-center gap-1.5">
                  {item.icon}
                  <span>{label}</span>
                </span>
              ) : (
                label
              )}
            </dt>
            <dd>{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );

  if (!hasTips) return list;

  return <Tooltip.Provider delay={180}>{list}</Tooltip.Provider>;
}
