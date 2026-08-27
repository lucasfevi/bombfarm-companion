import { Bar } from '@bombfarm/ui';
import { useCopy, useLocale } from '../../lib/copy';
import { formatEnergyPercent } from '../../lib/format';

/**
 * How full a hero's energy is. Rendered on every card, in every rotation state, because it is the
 * only thing that separates two heroes sitting in the same list for different reasons — one at
 * full energy waiting for a field slot, one part-filled waiting for a rest slot.
 *
 * An absent fraction renders the empty track and the missing-data string rather than nothing at
 * all: a card that drops the row entirely is shorter than its neighbours, and one that draws an
 * empty bar with no reading claims zero energy, which is a different fact from "not sent".
 */
export function EnergyBar({ testId, fraction }: { testId: string; fraction: number | undefined }) {
  const t = useCopy();
  const { locale } = useLocale();

  const known = fraction !== undefined;
  const percent = known ? Math.min(Math.max(fraction, 0), 1) * 100 : 0;

  return (
    <div data-testid={testId} className="flex items-center gap-2">
      <span className="sr-only">{t.liveEnergyLabel}</span>
      <div className="min-w-0 flex-1">
        <Bar percent={percent} />
      </div>
      <span data-testid={`${testId}-value`} className="shrink-0 text-[10px] leading-none tabular-nums text-muted">
        {known ? formatEnergyPercent(fraction, locale) : t.fidelityStatusMissing}
      </span>
    </div>
  );
}
