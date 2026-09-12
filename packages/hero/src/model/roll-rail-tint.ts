export type RollTint = 'low' | 'mid' | 'high';

/**
 * OURS, AND NOT THE GAME'S. The game stamps a hero with one letter for the whole roll and
 * publishes no tiering of a single statistic, so these thirds are a reading aid this app invented
 * — which is why the panel prints a note saying so beside the rail. Fixed thirds rather than a
 * fitted split, because there is nothing to fit them to.
 */
export function railTintFor(percentile: number): RollTint {
  if (percentile < 100 / 3) return 'low';
  if (percentile < 200 / 3) return 'mid';
  return 'high';
}
