import type { TeamPlanAllowedChanges, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import type { ScopeState } from './hero-scope';

export type TeamPlanControls = {
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  objective: TeamPlanObjective;
  allowedChanges: TeamPlanAllowedChanges;
  ignoreFieldCrowding: boolean;
  /** The phase both objectives score at, or `null` for the objective's own default. Resolved
   *  through `resolveTeamPlanTargetPhase`, never read directly — it is a default until
   *  `targetPhaseChosen`. */
  targetPhase: number | null;
  /** `true` once the player has picked from the phase control, None included — the same
   *  choice-vs-default split a host's own farm phase view makes. */
  targetPhaseChosen: boolean;
};

/**
 * What the search is asked to score, which is NOT the domain's own default. `runTeamPlan` keeps
 * `'dps'` when the field is absent, so every other caller stays byte-identical; a host asking for
 * this package's controls gets gold instead, because a roster tuned for damage can farm
 * measurably worse.
 */
export const DEFAULT_TEAM_PLAN_OBJECTIVE: TeamPlanObjective = 'farm';

export function isTeamPlanObjective(value: unknown): value is TeamPlanObjective {
  return value === 'dps' || value === 'farm';
}

/** Both kinds of change on the table — the same default the domain applies when the field is
 *  absent, restated here because this is where the control's initial value comes from. */
export const DEFAULT_TEAM_PLAN_ALLOWED_CHANGES: TeamPlanAllowedChanges = 'both';

export function isTeamPlanAllowedChanges(value: unknown): value is TeamPlanAllowedChanges {
  return value === 'points' || value === 'gear' || value === 'both';
}

export const DEFAULT_TEAM_PLAN_FORGE_FLOOR = 10;

export const DEFAULT_TEAM_PLAN_CONTROLS: TeamPlanControls = {
  scopeByHeroId: {},
  forgeFloor: DEFAULT_TEAM_PLAN_FORGE_FLOOR,
  objective: DEFAULT_TEAM_PLAN_OBJECTIVE,
  allowedChanges: DEFAULT_TEAM_PLAN_ALLOWED_CHANGES,
  ignoreFieldCrowding: false,
  targetPhase: null,
  targetPhaseChosen: false,
};

export function isScopeState(value: string): value is ScopeState {
  return value === 'optimize' || value === 'donate' || value === 'leaveAlone';
}

export function clampForgeFloor(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(0, Math.min(FORJA_MAX, Math.round(value)));
}

export function clampTargetPhase(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(600, Math.round(value)));
}
