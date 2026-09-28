/**
 * What the Heroes screen remembers between visits: the roster's presentation, order and filters,
 * and the board's and table's own switches. Its own key, beside the other screens'.
 */
import { DEFAULT_ROSTER_VIEW_PREFS, normalizeRosterViewPrefs, type RosterViewPrefs } from '@bombfarm/hero/model';

const HEROES_VIEW_STORAGE_KEY = 'bfc-heroes-view';

/** Never throws and never returns a partial record: an absent, unparseable or half-written value
 *  reads as the defaults. */
export function loadHeroesView(): RosterViewPrefs {
  try {
    const stored = window.localStorage.getItem(HEROES_VIEW_STORAGE_KEY);
    if (stored === null) return DEFAULT_ROSTER_VIEW_PREFS;
    return normalizeRosterViewPrefs(JSON.parse(stored));
  } catch {
    return DEFAULT_ROSTER_VIEW_PREFS;
  }
}

export function saveHeroesView(view: RosterViewPrefs): void {
  try {
    window.localStorage.setItem(HEROES_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // A remembered view is not worth failing a render over.
  }
}
