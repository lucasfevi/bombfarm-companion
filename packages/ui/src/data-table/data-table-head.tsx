'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '../cn';
import { dataTableHeadSectionClass, dataTableHeadStaticSectionClass } from '../data-table.recipe';
import { useDataTableScrollable } from './data-table-scrollable-context';

export function DataTableHead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  const scrollable = useDataTableScrollable();
  return (
    <thead
      className={cn(scrollable ? dataTableHeadSectionClass : dataTableHeadStaticSectionClass, className)}
      {...props}
    >
      {children}
    </thead>
  );
}
