import type { ReactNode } from 'react';
import { cn } from './cn';

export type ErrorScreenProps = {
  title: ReactNode;
  message?: ReactNode;
  /** The retry control, as a node: a link or form from a server page, a button from a client one. */
  action?: ReactNode;
  /** Heading tag for `title` — defaults to `h2`, as in `EmptyState`. */
  headingLevel?: 1 | 2 | 3 | 4;
  className?: string | undefined;
};

const HEADING_TAG = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
} as const;

export function ErrorScreen({ title, message, action, headingLevel = 2, className }: ErrorScreenProps) {
  const Heading = HEADING_TAG[headingLevel];

  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-2 rounded-md border border-line bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      <Heading className="text-lg font-semibold text-ink">{title}</Heading>
      {message ? <p className="m-0 max-w-prose text-sm text-muted">{message}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
