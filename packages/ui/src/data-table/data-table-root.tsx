'use client';

import { cn } from '../cn';
import type { DataTableRootProps } from './types';

export function DataTableRoot({
  scrollable = false,
  maxRows = 11,
  rowHeight = '2rem',
  className,
  children,
}: DataTableRootProps) {
  return (
    <div
      className={cn(scrollable && 'overflow-auto', className)}
      style={scrollable ? { maxHeight: `calc(${rowHeight} * ${maxRows})` } : undefined}
    >
      {children}
    </div>
  );
}
