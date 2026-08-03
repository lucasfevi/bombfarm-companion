'use client';

import { cn } from '../cn';
import type { DataTableCaptionProps } from './types';

export function DataTableCaption({ className, children, ...props }: DataTableCaptionProps) {
  return (
    <caption className={cn('sr-only', className)} {...props}>
      {children}
    </caption>
  );
}
