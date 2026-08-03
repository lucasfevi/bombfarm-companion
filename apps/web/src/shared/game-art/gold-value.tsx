import type { ReactNode } from 'react';
import { goldIconSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';

/** Gold amount with the in-game coin icon prefixed. */
export function GoldValue({
  children,
  className,
  iconClassName,
}: {
  children: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center justify-end gap-1', className)}>
      <img
        src={goldIconSrc()}
        alt=""
        aria-hidden
        className={cn('size-3.5 shrink-0 object-contain', iconClassName)}
      />
      <span>{children}</span>
    </span>
  );
}
