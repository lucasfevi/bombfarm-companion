import { cn } from './cn';

export type SkeletonProps = {
  shape?: 'line' | 'block' | 'rows';
  /** How many table rows `shape="rows"` draws. */
  rows?: number;
  /** Names the loading region for assistive technology; without it the skeleton is purely decorative. */
  label?: string;
  className?: string | undefined;
};

const BONE = 'motion-safe:animate-pulse rounded-md border border-line/55 bg-surface';

const SHAPE_CLASS = {
  line: 'h-3 w-full',
  block: 'h-24 w-full',
} as const;

export function Skeleton({ shape = 'line', rows = 5, label, className }: SkeletonProps) {
  const skeleton =
    shape === 'rows' ? (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className={cn('h-8 w-full', BONE)} />
        ))}
      </div>
    ) : (
      <div className={cn(SHAPE_CLASS[shape], BONE, className)} aria-hidden="true" />
    );

  if (!label) return skeleton;
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {skeleton}
    </div>
  );
}
