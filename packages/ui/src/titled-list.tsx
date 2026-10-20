import type { ReactNode } from 'react';
import { cn } from './cn';

export type TitledListProps = {
  title: string;
  items: readonly ReactNode[];
  /** Shown in place of the list when there are no items. */
  empty: ReactNode;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string | undefined;
};

export function TitledList({ title, items, empty, headingLevel = 3, className }: TitledListProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-label={title} className={cn('flex flex-col gap-1.5', className)}>
      <Heading className="m-0 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{title}</Heading>
      {items.length === 0 ? (
        <p className="m-0 text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex flex-col gap-1.5 border-b border-line pb-2 text-[13px] last:border-b-0 last:pb-0"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
