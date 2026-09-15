/**
 * Which hero the Heroes screen is looking at, across an account that moves underneath it.
 *
 * The account is re-read every few seconds and every read rebuilds the roster from a fresh parse,
 * so the records are new objects and the list can be a different length and a different order than
 * the one the player clicked in. A selection held as a position in that list would silently become
 * a selection of a different hero; these two rules hold it by identity instead.
 */
import type { RosterHeroRow } from '@bombfarm/hero/model';

/**
 * The hero at the top of the list — the strongest, until the toolbar is told to order it otherwise.
 *
 * The rule is "whatever the list is showing first", not a second ranking of its own: a default
 * that named a hero the player has to scroll to would read as an arbitrary pick, and a detail pane
 * left empty beside a populated list reads as a broken screen.
 */
export function defaultSelectedHeroId(ordered: readonly RosterHeroRow[]): string | null {
  return ordered[0]?.id ?? null;
}

/**
 * The selection to hold after a roster arrives — by hero id, never by position.
 *
 * A hero the account no longer carries (sold, or a read that could not place it) falls back to
 * {@link defaultSelectedHeroId} rather than to the row that happens to have taken its index, which
 * would silently swap which hero the panels describe while the player was not looking.
 */
export function resolveSelectedHeroId(
  previous: string | null,
  ordered: readonly RosterHeroRow[],
): string | null {
  if (previous !== null && ordered.some((row) => row.id === previous)) return previous;
  return defaultSelectedHeroId(ordered);
}

export function selectedRow(
  selectedId: string | null,
  ordered: readonly RosterHeroRow[],
): RosterHeroRow | null {
  return ordered.find((row) => row.id === selectedId) ?? null;
}
