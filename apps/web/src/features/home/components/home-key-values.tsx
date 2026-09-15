import { cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';

export function HomeKeyValues({
  rows,
  testId,
  className,
}: {
  rows: readonly (readonly [string, string] | readonly [string, string, 'accent'])[];
  testId: string;
  className?: string;
}) {
  return (
    <dl className={cn('m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm', className)}>
      {rows.map(([label, value, tone]) => (
        <div key={label} className="contents">
          <dt className={cn(mutedClass, 'self-baseline')} data-testid={`${testId}-label`}>
            {label}
          </dt>
          <dd
            className={cn(
              'm-0 text-right font-mono tabular-nums',
              tone === 'accent' && 'text-2xl leading-none font-bold text-accent',
            )}
            data-testid={`${testId}-value`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
