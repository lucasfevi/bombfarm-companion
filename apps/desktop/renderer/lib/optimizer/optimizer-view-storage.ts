/**
 * What the Optimizer screen remembers between visits: every control the package's setup panel and
 * scope board expose. Its own key, deliberately not the web planner's — the two apps read
 * different accounts out of different stores, and sharing a key would be a claim that one
 * screen's state is the other's.
 *
 * A plan is never written here: `OptimizerView` is exactly `TeamPlanControls`, the shape the
 * package persists nothing beyond, and a stored plan-shaped value reads back as the defaults like
 * any other unrecognised field.
 */
import {
  DEFAULT_TEAM_PLAN_CONTROLS,
  isScopeState,
  isTeamPlanAllowedChanges,
  isTeamPlanObjective,
  clampForgeFloor,
  clampTargetPhase,
  type ScopeState,
  type TeamPlanControls,
} from '@bombfarm/team-plan/core';

const OPTIMIZER_VIEW_STORAGE_KEY = 'bfc-optimizer-view';

export type OptimizerView = TeamPlanControls;

/** The package's own defaults, re-exported rather than restated. */
export const DEFAULT_OPTIMIZER_VIEW: OptimizerView = DEFAULT_TEAM_PLAN_CONTROLS;

function normalizeScopeMap(value: unknown): Record<string, ScopeState> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_OPTIMIZER_VIEW.scopeByHeroId;
  }
  const out: Record<string, ScopeState> = {};
  for (const [heroId, scope] of Object.entries(value)) {
    if (typeof scope === 'string' && isScopeState(scope)) out[heroId] = scope;
  }
  return out;
}

function normalizeObjective(value: unknown): OptimizerView['objective'] {
  return isTeamPlanObjective(value) ? value : DEFAULT_OPTIMIZER_VIEW.objective;
}

function normalizeAllowedChanges(value: unknown): OptimizerView['allowedChanges'] {
  return isTeamPlanAllowedChanges(value) ? value : DEFAULT_OPTIMIZER_VIEW.allowedChanges;
}

function normalizeForgeFloor(value: unknown): number {
  return typeof value === 'number' ? clampForgeFloor(value) : DEFAULT_OPTIMIZER_VIEW.forgeFloor;
}

function normalizeIgnoreFieldCrowding(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_OPTIMIZER_VIEW.ignoreFieldCrowding;
}

// SPEC_DEVIATION: a bare "clampTargetPhase(value) when a number, else null" would map 0 and -3 to
// 1 (the package's clamp floors every finite number at 1, never returning null for one) — but the
// stored value's rejects are 0, -3, '30' and null all reading back as null. Rounding below 1 is
// therefore rejected outright, same as a non-number; a number that rounds to 1 or above is still
// clamped through the package rule, matching 12.5 -> 13 and 900 -> 600.
function normalizeTargetPhase(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.round(value) < 1) return null;
  return clampTargetPhase(value);
}

function normalizeTargetPhaseChosen(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function normalizeOptimizerView(value: unknown): OptimizerView {
  if (typeof value !== 'object' || value === null) return DEFAULT_OPTIMIZER_VIEW;
  const raw = value as Record<string, unknown>;
  return {
    scopeByHeroId: normalizeScopeMap(raw.scopeByHeroId),
    objective: normalizeObjective(raw.objective),
    allowedChanges: normalizeAllowedChanges(raw.allowedChanges),
    forgeFloor: normalizeForgeFloor(raw.forgeFloor),
    ignoreFieldCrowding: normalizeIgnoreFieldCrowding(raw.ignoreFieldCrowding),
    targetPhase: normalizeTargetPhase(raw.targetPhase),
    targetPhaseChosen: normalizeTargetPhaseChosen(raw.targetPhaseChosen),
  };
}

/** Never throws and never returns a partial record: an absent, unparseable or half-written value
 *  reads as the defaults. */
export function loadOptimizerView(): OptimizerView {
  try {
    const stored = window.localStorage.getItem(OPTIMIZER_VIEW_STORAGE_KEY);
    if (stored === null) return DEFAULT_OPTIMIZER_VIEW;
    const parsed: unknown = JSON.parse(stored);
    return normalizeOptimizerView(parsed);
  } catch {
    return DEFAULT_OPTIMIZER_VIEW;
  }
}

export function saveOptimizerView(view: OptimizerView): void {
  try {
    window.localStorage.setItem(OPTIMIZER_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Remembered controls are not worth failing a render over.
  }
}
