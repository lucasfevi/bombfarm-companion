'use client';

import type { HTMLAttributes } from 'react';

export function DataTableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}
