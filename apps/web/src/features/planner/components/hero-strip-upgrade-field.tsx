'use client';

import { cn } from '@bombfarm/ui';

const microLabelClass = 'text-[9px] font-bold leading-none tracking-[0.1em] text-muted uppercase';

export function UpgradeField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1', className)}>
      <span className={microLabelClass}>{label}</span>
      <div className="grid grid-cols-[4.25rem_minmax(0,auto)] items-stretch gap-1">{children}</div>
    </div>
  );
}
