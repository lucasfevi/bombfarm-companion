import { DEFAULT_ROSTER_VIEW_PREFS, normalizeRosterViewPrefs, type RosterViewPrefs } from '@bombfarm/hero/model';
import { readJson, writeJson } from '@/shared/lib/storage';

export const ROSTER_VIEW_STORAGE_KEY = 'bf-hp-roster-view-v1';

export function loadRosterView(): RosterViewPrefs {
  if (typeof window === 'undefined') return DEFAULT_ROSTER_VIEW_PREFS;
  return normalizeRosterViewPrefs(readJson<unknown>(ROSTER_VIEW_STORAGE_KEY, null));
}

export function saveRosterView(view: RosterViewPrefs): void {
  writeJson(ROSTER_VIEW_STORAGE_KEY, view);
}
