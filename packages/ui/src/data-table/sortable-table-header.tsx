'use client';

import { DataTableHeader } from './data-table-header';
import type { SortableTableHeaderProps } from './types';

/** Back-compat sortable header used by older call sites / stories. */
export function SortableTableHeader<T extends string>({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
  className,
  stopPropagation = false,
}: SortableTableHeaderProps<T>) {
  return (
    <DataTableHeader
      sortable
      col={col}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      align={align}
      className={className}
      stopPropagation={stopPropagation}
    >
      {label}
    </DataTableHeader>
  );
}
