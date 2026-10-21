import type { ReactNode } from 'react';
import { cn } from './cn';

export type DisclosureProps = {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string | undefined;
};

export function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn('rounded-sm border border-line px-2.5 py-1.5', className)}>
      <summary className="cursor-pointer text-[13px] text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {summary}
      </summary>
      <div className="pt-2.5 pb-1">{children}</div>
    </details>
  );
}
