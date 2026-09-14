import { cn } from '@bombfarm/ui';

const BARS = ['h-7 w-3/4', 'h-3 w-full', 'h-3 w-full', 'h-3 w-full'];

export function OptimizerCardSkeleton() {
  return (
    <div data-testid="home-optimizer-skeleton" className="flex flex-col gap-2" aria-hidden>
      {BARS.map((bar, index) => (
        <div key={index} className={cn('rounded-sm bg-bg-2', bar)} />
      ))}
    </div>
  );
}
