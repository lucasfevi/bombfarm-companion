'use client';

import { cn } from '../cn';
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
      {children}
    </div>
  );
}
