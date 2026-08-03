'use client';

import { cn } from '../cn';
import { dataTableCellRecipe } from '../data-table.recipe';
import type { DataTableRowHeaderProps } from './types';

/** Body row label (`<th scope="row">`) — same pad as cells, not a column header. */
export function DataTableRowHeader({ className, children, ...props }: DataTableRowHeaderProps) {
  return (
    <th
      scope="row"
      className={cn(dataTableCellRecipe({ align: 'left', nowrap: true }), className)}
      {...props}
    >
      {children}
    </th>
  );
}
