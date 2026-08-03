'use client';

import { cn } from '../cn';
import type { TabsListProps } from './types';

export function TabsList({ className, children }: TabsListProps) {
  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      className={cn('relative flex flex-wrap gap-0.5 border-b border-line pb-px', className)}
    >
      {children}
    </div>
  );
}
