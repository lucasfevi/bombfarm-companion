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
      {items.map((item) => (
        <div key={item.id}>
          <dt>{item.tip ? <TipLabel label={item.label} tip={item.tip} /> : item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );

  if (!hasTips) return list;

  return <Tooltip.Provider delay={180}>{list}</Tooltip.Provider>;
}
