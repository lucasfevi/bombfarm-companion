import { useCopy, useLocale } from '../../lib/copy';
import { energyPercent, formatEnergyPercent } from '../../lib/format';

/**
 * How full a hero's energy is. Rendered on every row, in every rotation state, because it is the
 * only thing that separates two heroes sitting in the same list for different reasons — one at
 * full energy waiting for a field slot, one part-filled waiting for a rest slot.
 *
 * An absent fraction renders the empty track and the missing-data string rather than nothing at
 * all: a row that drops this entirely is shorter than its neighbours, and one that draws an empty
 * bar with no reading claims zero energy, which is a different fact from "not sent".
 *
 * Its own track/fill rather than `packages/ui`'s `Bar` — that primitive is shared with the web
 * planner's ranking bars, sized and squared off for a two-row card; this one is slimmer and
 * rounded for a single inline line. `min-w-9` on the reading reserves its digit column against the
 * two-vs-three-digit jump (9% → 10%, 99% → 100%) so a ticking value never shifts what follows it.
 */
export function EnergyBar({ testId, fraction }: { testId: string; fraction: number | undefined }) {
  const t = useCopy();
  const { locale } = useLocale();

  // The same floored number the label prints, so the fill and the reading beside it never disagree.
  const known = fraction !== undefined;
  const percent = known ? energyPercent(fraction) : 0;

  return (
    <div data-testid={testId} className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="sr-only">{t.liveEnergyLabel}</span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      <span
        data-testid={`${testId}-value`}
        className="inline-block min-w-9 shrink-0 text-right text-[10px] leading-none tabular-nums text-muted"
      >
        {known ? formatEnergyPercent(fraction, locale) : t.fidelityStatusMissing}
      </span>
    </div>
  );
}
