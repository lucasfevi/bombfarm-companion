import { useCopy } from '../../lib/copy';
import { energyPercent } from '../../lib/format';

/**
 * How full a hero's energy is, as a track and fill — rendered on every row, in every rotation
 * state, because it is the only thing that separates two heroes sitting in the same list for
 * different reasons — one at full energy waiting for a field slot, one part-filled waiting for a
 * rest slot.
 *
 * An absent fraction still renders the empty track rather than nothing at all: a row that drops
 * this entirely is shorter than its neighbours, and one that draws an empty bar with no reading
 * beside it (see `hero-row.tsx`'s percentage column) claims zero energy, which is a different fact
 * from "not sent".
 *
 * The row places the percentage reading in its own fixed grid column rather than inside this
 * component, so that column reserves the same width whether or not the row beside it has a
 * countdown — this component only ever needs to own the track.
 *
 * Its own track/fill rather than `packages/ui`'s `Bar` — that primitive is shared with the web
 * planner's ranking bars, sized and squared off for a two-row card; this one is slimmer and
 * rounded for a single inline line.
 */
export function EnergyBar({ testId, fraction }: { testId: string; fraction: number | undefined }) {
  const t = useCopy();
  const percent = fraction !== undefined ? energyPercent(fraction) : 0;

  return (
    <div data-testid={testId} className="min-w-0">
      <span className="sr-only">{t.liveEnergyLabel}</span>
      <div className="h-1 min-w-0 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  );
}
