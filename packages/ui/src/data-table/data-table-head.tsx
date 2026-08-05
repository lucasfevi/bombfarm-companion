'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '../cn';
import { dataTableHeadSectionClass } from '../data-table.recipe';

export function DataTableHead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn(dataTableHeadSectionClass, className)} {...props}>
      {children}
    </thead>
  );
}
