import { clockIconSrc } from '@bombfarm/domain/wiki-assets';
import { cn } from '@bombfarm/ui';

/**
 * The in-game gate timer's own clock. Marks a gate row on the Farm Ranking board — gate phases
 * are the timed challenge, so the clock is the game's own signifier for it, in place of a
 * generic chip.
 */
export function ClockIcon({ className }: { className?: string }) {
  return (
    <img
      src={clockIconSrc()}
      alt=""
      aria-hidden
      className={cn('size-5 shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
