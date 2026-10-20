import type { ReactNode } from 'react';
import { cn } from './cn';

export type DefinitionListItem = {
  term: ReactNode;
  detail: ReactNode;
};

export type DefinitionListProps = {
  items: readonly DefinitionListItem[];
  /** `ruled` sets each row on a hairline with the value right-aligned and bold. */
  variant?: 'grid' | 'ruled';
  className?: string | undefined;
};

const LIST_CLASS = {
  grid: 'm-0 grid grid-cols-[minmax(8rem,12rem)_1fr] gap-x-4 gap-y-1 text-[13px] max-[520px]:grid-cols-1',
  ruled: 'm-0 grid grid-cols-[1fr_auto] gap-x-4 text-[13px]',
} as const;

const TERM_CLASS = {
  grid: 'text-muted',
  ruled: 'border-b border-line/70 py-1.5 text-muted',
} as const;

const DETAIL_CLASS = {
  grid: 'm-0 min-w-0 break-words',
  ruled: 'm-0 min-w-0 border-b border-line/70 py-1.5 text-right font-semibold break-words',
} as const;

export function DefinitionList({ items, variant = 'grid', className }: DefinitionListProps) {
  return (
    <dl className={cn(LIST_CLASS[variant], className)}>
      {items.map((item, index) => (
        <div key={index} className="contents">
          <dt className={TERM_CLASS[variant]}>{item.term}</dt>
          <dd className={DETAIL_CLASS[variant]}>{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
