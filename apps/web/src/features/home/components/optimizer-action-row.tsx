import { cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import type { PlanActionRow } from '../model/optimizer-actions';

export function OptimizerActionRow({ row }: { row: PlanActionRow }) {
  return (
    <li data-testid="home-optimizer-action" data-kind={row.kind} className="text-sm">
      {row.text}
      {row.contribution === null ? null : (
        <span
          data-testid="home-optimizer-contribution"
          className={cn(mutedClass, 'ml-2 font-mono tabular-nums')}
        >
          {row.contribution}
        </span>
      )}
    </li>
  );
}
