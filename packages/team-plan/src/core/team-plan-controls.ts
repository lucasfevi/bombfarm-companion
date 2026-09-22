import type { TeamPlanAllowedChanges, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { NO_AURAS_AT_CAP, TEAM_AURA_SWITCH_IDS, type AurasAtCap, type TeamAuraId } from '@bombfarm/domain/team-buffs';
import type { ScopeState } from './hero-scope';

export type TeamPlanControls = {
  scopeByHeroId: Record<string, ScopeState>;
  forgeFloor: number;
  objective: TeamPlanObjective;
  allowedChanges: TeamPlanAllowedChanges;
  ignoreFieldCrowding: boolean;
  /** The team auras to score at their cap the whole time — the domain's `aurasAtCap`, in the
   *  domain's own order. A host that offers no control for it keeps `NO_AURAS_AT_CAP`. */
  aurasAtCap: AurasAtCap;
  /** The phase both objectives score at, or `null` for the objective's own default. Resolved
   *  through `resolveTeamPlanTargetPhase`, never read directly — it is a default until
   *  `targetPhaseChosen`. */
  targetPhase: number | null;
  /** `true` once the player has picked from the phase control, None included — the same
   *  choice-vs-default split a host's own farm phase view makes. */
  targetPhaseChosen: boolean;
  /** The gate a Gate clear plan fights, its own control beside the farm phase: a player clears
   *  a gate to leave the phase they farm. `null` resolves to the account's next gate. */
  gatePhase: number | null;
};

/**
 * The objectives this package's control offers, in display order. The domain's rotation `'dps'`
 * is not among them: a rotation rewards a stint that outlasts the rest, so it recommends energy
 * when the job is passing a gate. Its two windowed forms answer that question instead — a gate
 * clear over the act's timer, and the one-minute duel.
 */
export const TEAM_PLAN_OBJECTIVES = ['farm', 'gateClear', 'pvp'] as const satisfies readonly TeamPlanObjective[];

/** The objectives any host can score: a duel needs the phase its room is hardened to, which only
 *  a host that reads the PVP state can supply. */
export const TEAM_PLAN_OBJECTIVES_WITHOUT_PVP = ['farm', 'gateClear'] as const satisfies readonly TeamPlanObjective[];

/**
 * What the search is asked to score, which is NOT the domain's own default. `runTeamPlan` keeps
 * `'dps'` when the field is absent, so every other caller stays byte-identical; a host asking for
 * this package's controls gets gold instead, because a roster tuned for damage can farm
 * measurably worse.
 */
export const DEFAULT_TEAM_PLAN_OBJECTIVE: TeamPlanObjective = 'farm';

/** One of the objectives the control offers — a stored `'dps'` from before the windowed
 *  objectives replaced it reads back as the default, like any other unrecognised value. */
export function isTeamPlanObjective(value: unknown): value is TeamPlanObjective {
  return (TEAM_PLAN_OBJECTIVES as readonly unknown[]).includes(value);
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
  aurasAtCap: NO_AURAS_AT_CAP,
  targetPhase: null,
  targetPhaseChosen: false,
  gatePhase: null,
};

export function isScopeState(value: string): value is ScopeState {
  return value === 'optimize' || value === 'donate' || value === 'leaveAlone';
}

export function clampForgeFloor(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(0, Math.min(FORJA_MAX, Math.round(value)));
}

export function isTeamAuraId(value: unknown): value is TeamAuraId {
  return typeof value === 'string' && (TEAM_AURA_SWITCH_IDS as readonly string[]).includes(value);
}

/** A stored value read back as the list it was, in the domain's order, dropping anything that is
 *  not an aura id; an absent, malformed or empty value is the domain's own frozen empty list. */
export function normalizeAurasAtCap(value: unknown): AurasAtCap {
  if (!Array.isArray(value)) return NO_AURAS_AT_CAP;
  const kept = TEAM_AURA_SWITCH_IDS.filter((id) => value.includes(id));
  return kept.length === 0 ? NO_AURAS_AT_CAP : kept;
}

/** One aura flipped, the list kept in the domain's own order so two equal sets are one value. */
export function withAuraAtCap(aurasAtCap: AurasAtCap, auraId: TeamAuraId, atCap: boolean): AurasAtCap {
  if (aurasAtCap.includes(auraId) === atCap) return aurasAtCap;
  const next = TEAM_AURA_SWITCH_IDS.filter((id) => (id === auraId ? atCap : aurasAtCap.includes(id)));
  return next.length === 0 ? NO_AURAS_AT_CAP : next;
}

export function clampTargetPhase(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(600, Math.round(value)));
}

/** A gate phase is kept only when it names a gate; anything else reads as "the next gate". */
export function normalizeGatePhase(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const phase = Math.round(value);
  return wikiPhaseLine(phase)?.gate === true ? phase : null;
}
