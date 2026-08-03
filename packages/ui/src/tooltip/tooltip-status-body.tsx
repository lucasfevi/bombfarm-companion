'use client';

import {
  tooltipStatusListClass,
  tooltipStatusListSoftClass,
  tooltipStatusTitleClass,
} from '../tooltip.recipe';

/** Structured status tip — title + issue list (tab trust chrome). */
export function TooltipStatusBody({
  title,
  issues,
  tone = 'warn',
}: {
  title: string;
  issues: readonly string[];
  tone?: 'warn' | 'soft';
}) {
  const listClass = tone === 'soft' ? tooltipStatusListSoftClass : tooltipStatusListClass;
  return (
    <div data-slot="tooltip-status-body">
      <p className={tooltipStatusTitleClass}>{title}</p>
      {issues.length > 0 ? (
        <ul className={listClass}>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
