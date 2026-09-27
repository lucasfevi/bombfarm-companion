import { heroRankBandClass, heroRankFillClass, heroRankTextClass } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { gradeRailFor } from '../model';

/**
 * The grade scale, drawn to the measured table: a letter's share of the width is its share of the
 * scale, so E spans far more of it than C does because that is what the corpus says.
 *
 * Each band carries the colour the game prints its own grade in, so the six read left to right as
 * the ladder they are; the hero's own grade is the one lifted out of them. Each boundary is a band
 * rather than a line because that is the shape of the evidence — the corpus locates it inside an
 * interval and no closer — and it is drawn over the grades it separates, being about both.
 */
export function GradeRailView({ mean, railLetter }: { mean: number; railLetter: string }) {
  const rail = gradeRailFor(mean);

  return (
    <div className="relative mt-1.5 h-7 w-full overflow-hidden rounded-sm border border-line bg-bg">
      {rail.segments.map((segment) => {
        const active = segment.letter === railLetter;
        return (
          <span
            key={segment.letter}
            className={cn(
              'absolute inset-y-0 flex items-center justify-center text-[10px] font-bold tracking-[0.08em]',
              heroRankBandClass(segment.letter, active),
              active ? heroRankTextClass(segment.letter) : 'text-muted',
            )}
            style={{ left: `${segment.startPct}%`, width: `${segment.endPct - segment.startPct}%` }}
          >
            {segment.letter}
          </span>
        );
      })}
      {rail.boundaries.map((boundary) => (
        <span
          key={`${boundary.below}${boundary.above}`}
          aria-hidden="true"
          className="absolute inset-y-0 bg-bg/30"
          style={{ left: `${boundary.startPct}%`, width: `${boundary.endPct - boundary.startPct}%` }}
        />
      ))}
      <span
        className="absolute inset-y-0 w-0.5 bg-ink"
        style={{ left: `${rail.markerPct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * The same scale in miniature, for a line of a card: no letters and no boundary bands, only the
 * hero's own grade at full strength among the others' washes, and a marker at its mean that
 * overhangs the bar so it reads at this height.
 */
export function GradeLadder({ mean, railLetter }: { mean: number; railLetter: string }) {
  const rail = gradeRailFor(mean);
  return (
    <span className="relative block h-2 w-full" aria-hidden="true" data-slot="grade-ladder">
      {rail.segments.map((segment) => (
        <span
          key={segment.letter}
          data-letter={segment.letter}
          className={cn(
            'absolute inset-y-0',
            segment.letter === railLetter
              ? heroRankFillClass(segment.letter)
              : heroRankBandClass(segment.letter, true),
          )}
          style={{ left: `${segment.startPct}%`, width: `${segment.endPct - segment.startPct}%` }}
        />
      ))}
      <span
        className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 bg-ink"
        style={{ left: `${rail.markerPct}%` }}
        data-slot="grade-ladder-marker"
      />
    </span>
  );
}
