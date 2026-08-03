const PHASES_VIEW_KEY = 'bf-hp-phases-view-v1';

export type PhasesViewState = {
  phase: number;
};

export function defaultPhasesView(): PhasesViewState {
  return { phase: 1 };
}

export function loadPhasesView(): PhasesViewState {
  try {
    const raw = localStorage.getItem(PHASES_VIEW_KEY);
    if (!raw) return defaultPhasesView();
    const parsed = JSON.parse(raw) as Partial<PhasesViewState>;
    const phase = typeof parsed.phase === 'number' ? parsed.phase : 1;
    return { phase: Math.max(1, Math.min(600, Math.round(phase))) };
  } catch {
    return defaultPhasesView();
  }
}

export function savePhasesView(state: PhasesViewState): void {
  try {
    localStorage.setItem(PHASES_VIEW_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}
