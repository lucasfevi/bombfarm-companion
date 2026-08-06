'use client';

import { Icon } from '../icon';
import { dataTableSortIdleIconClass } from '../data-table.recipe';

export function SortIdleIcon() {
  return (
    <span className={dataTableSortIdleIconClass} aria-hidden="true">
      <Icon name="chevron-up" className="size-2 -mb-0.5" />
      <Icon name="chevron-down" className="size-2 -mt-0.5" />
    </span>
  );
}
