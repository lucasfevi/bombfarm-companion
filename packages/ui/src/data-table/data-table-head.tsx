'use client';

import type { HTMLAttributes } from 'react';

export function DataTableHead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}
