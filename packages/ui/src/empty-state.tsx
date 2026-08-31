import type { PropsWithChildren, ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { cn } from './cn';

export interface EmptyStateProps extends PropsWithChildren {
  icon?: IconName;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  /** Heading tag for `title` — defaults to `h2` so it nests correctly under different pages. */
  headingLevel?: 2 | 3 | 4;
  className?: string | undefined;
}

const HEADING_TAG = {
  2: 'h2',
  3: 'h3',
  4: 'h4',
} as const;

/**
 * EmptyState — "no game / no items / no filter matches" placeholder with a
 * next-step hint slot. Centered within its own container (not the viewport)
 * so it composes inside panels later.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
  children,
}: EmptyStateProps) {
  const Heading = HEADING_TAG[headingLevel];

  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      {icon ? <Icon name={icon} size="lg" className="text-muted" /> : null}
      <Heading className="text-base font-semibold text-ink">{title}</Heading>
      {description ? <p className="max-w-prose text-sm text-muted">{description}</p> : null}
      {children}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
