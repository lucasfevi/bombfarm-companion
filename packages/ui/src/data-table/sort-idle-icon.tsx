'use client';

import { HiMiniChevronDown, HiMiniChevronUp } from 'react-icons/hi2';
import { dataTableSortIdleIconClass } from '../data-table.recipe';

export function SortIdleIcon() {
  return (
    <span className={dataTableSortIdleIconClass} aria-hidden="true">
      <HiMiniChevronUp size={8} className="-mb-0.5" />
      <HiMiniChevronDown size={8} className="-mt-0.5" />
    </span>
  );
}
