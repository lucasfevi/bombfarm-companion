import type { SheetKey } from '@bombfarm/domain/planner-constants';

/**
 * The stat names a respec hero card prints, supplied by the host.
 *
 * These are the only two player-facing strings the farm screen shows that are NOT the farm
 * screen's own: a hero's stat names and the column that heads them belong to the host's wider
 * dictionary, where the planner, the gear tab and the roster already print them. Copying them
 * into `@bombfarm/farm/copy` would make two dictionaries responsible for one set of words, and a
 * host would then show a hero "Crit Chance" in one screen and something else in another.
 */
export type FarmStatLabels = {
  /** Heads the stat-name column of a changed hero's ledger. */
  column: string;
  /** The full (never abbreviated) name of each point-spend key. */
  full: Readonly<Record<SheetKey, string>>;
};
