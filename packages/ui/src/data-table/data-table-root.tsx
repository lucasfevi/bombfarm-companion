'use client';

import { cn } from '../cn';
import { DataTableScrollableProvider } from './data-table-scrollable-context';
import type { DataTableRootProps } from './types';

export function DataTableRoot({
  scrollable = false,
  maxRows,
  minRows,
  rowHeight = '2rem',
  className,
  children,
  ref,
  ...rest
}: DataTableRootProps) {
  const style =
    scrollable && (maxRows != null || minRows != null)
      ? {
          ...(maxRows != null ? { maxHeight: `calc(${rowHeight} * ${maxRows})` } : {}),
          ...(minRows != null ? { minHeight: `calc(${rowHeight} * ${minRows})` } : {}),
        }
      : undefined;

  return (
    <div
      ref={ref}
      className={cn(scrollable && 'isolate min-h-0 overflow-auto', className)}
      style={style}
      {...rest}
    >
      <DataTableScrollableProvider value={scrollable}>{children}</DataTableScrollableProvider>
    </div>
  );
}
