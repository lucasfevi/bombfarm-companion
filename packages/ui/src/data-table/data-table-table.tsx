'use client';

import { cn } from '../cn';
import { dataTableClass } from '../data-table.recipe';
import type { DataTableTableProps } from './types';

export function DataTableTable({ className, children, ...props }: DataTableTableProps) {
  return (
    <table className={cn(dataTableClass, className)} {...props}>
      {children}
    </table>
  );
}
