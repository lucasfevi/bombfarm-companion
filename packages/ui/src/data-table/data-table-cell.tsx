'use client';

import { cn } from '../cn';
import { dataTableCellRecipe } from '../data-table.recipe';
import type { DataTableCellProps } from './types';

export function DataTableCell({ className, align, numeric, nowrap, children, ...props }: DataTableCellProps) {
  return (
    <td className={cn(dataTableCellRecipe({ align, numeric, nowrap }), className)} {...props}>
      {children}
    </td>
  );
}
