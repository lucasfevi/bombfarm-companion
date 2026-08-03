'use client';

import type { HTMLAttributes } from 'react';

export function DataTableBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}
