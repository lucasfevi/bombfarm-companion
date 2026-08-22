export const PLANNER_TAB_IDS = ['hero', 'gear', 'points'] as const;
export type PlannerTabId = (typeof PLANNER_TAB_IDS)[number];

export const PLANNER_TAB_STORAGE_KEY = 'bf-hp-planner-tab-v1';

export function isPlannerTabId(value: unknown): value is PlannerTabId {
  return typeof value === 'string' && (PLANNER_TAB_IDS as readonly string[]).includes(value);
}

export function loadPlannerTab(setupReady: boolean): PlannerTabId {
  if (typeof window === 'undefined') return setupReady ? 'points' : 'hero';
  try {
    const raw = window.localStorage.getItem(PLANNER_TAB_STORAGE_KEY);
    if (raw === 'check') return 'points';
    // A stored `'account'` needs no branch: the tab is a route of its own now, so it fails
    // `isPlannerTabId` and falls through to the same default a first-time visitor gets.
    if (isPlannerTabId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return setupReady ? 'points' : 'hero';
}

export function savePlannerTab(tab: PlannerTabId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLANNER_TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore */
  }
}
