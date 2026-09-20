import type { TeamPlanInputs } from './team-plan-inputs';
import type { TeamPlanControls } from './team-plan-controls';
import type { ScopeState } from './hero-scope';
import { clampForgeFloor, clampTargetPhase, withAuraAtCap } from './team-plan-controls';
import type { TeamAuraId } from '@bombfarm/domain/team-buffs';
import { mergeScopeForRoster } from './hero-scope';
import { planBasisSignature } from './plan-changes';

import { resolveTeamPlanTargetPhase } from './target-phase';

export { resolveTeamPlanTargetPhase };

/**
 * A gold plan left to find its own phase sweeps the phases the account has unlocked, and
 * `runTeamPlan` refuses to guess that ceiling: with no `max_phase` on the record there is nothing
 * to bound the sweep with. Naming a phase removes the sweep and with it the requirement, so this
 * is only ever true while the phase control sits on None.
 */
export function isFarmObjectiveUnavailable(
  maxPhase: number | null,
  resolvedTargetPhase: number | null,
): boolean {
  return maxPhase == null && resolvedTargetPhase == null;
}

/**
 * The identity of everything the plan depends on — {@link planBasisSignature}, kept under the
 * name the hosts call it by. It moves exactly when {@link describePlanChanges} would list a
 * counted change, and never on a field rotation, a rune's seconds ticking down or a re-derived
 * power figure: those used to mark every plan stale a minute after it was built.
 */
export function computeTeamPlanInputSignature(inputs: TeamPlanInputs, controls: TeamPlanControls): string {
  return planBasisSignature(inputs, controls);
}

export function isTeamPlanStale(appliedSignature: string | null, liveSignature: string): boolean {
  return appliedSignature != null && appliedSignature !== liveSignature;
}

export type TeamPlanControlChange =
  | { kind: 'scope'; heroId: string; scope: ScopeState }
  | { kind: 'forgeFloor'; value: number }
  | { kind: 'objective'; value: TeamPlanControls['objective'] }
  | { kind: 'allowedChanges'; value: TeamPlanControls['allowedChanges'] }
  | { kind: 'ignoreFieldCrowding'; value: boolean }
  | { kind: 'auraAtCap'; auraId: TeamAuraId; value: boolean }
  | { kind: 'targetPhase'; value: number | null };

function scopeMapsEqual(left: Record<string, ScopeState>, right: Record<string, ScopeState>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

export function applyTeamPlanControlChange(
  controls: TeamPlanControls,
  change: TeamPlanControlChange,
  context: {
    heroes: readonly { id: string; battleAllowed?: boolean }[];
    farmChosenPhase: number | null;
    phase: number | null;
  },
): { controls: TeamPlanControls; clearsPlan: boolean } | null {
  switch (change.kind) {
    // Always rewrite the *full* roster map (defaults + prior choices + this move). A partial
    // map left Donate-looking heroes (UI default) as Optimize in the solver input.
    case 'scope': {
      const previousResolved = mergeScopeForRoster([...context.heroes], controls.scopeByHeroId);
      const next = { ...previousResolved, [change.heroId]: change.scope };
      if (scopeMapsEqual(controls.scopeByHeroId, next)) return null;
      const assignmentChanged = previousResolved[change.heroId] !== change.scope;
      return {
        controls: { ...controls, scopeByHeroId: next },
        clearsPlan: assignmentChanged,
      };
    }

    case 'forgeFloor': {
      const next = clampForgeFloor(change.value);
      if (controls.forgeFloor === next) return null;
      return { controls: { ...controls, forgeFloor: next }, clearsPlan: false };
    }

    // Clears outright rather than marking stale: the two objectives report different quantities
    // in different units, so a plan built for one renders as a wrong number under the other's
    // copy.
    case 'objective': {
      if (controls.objective === change.value) return null;
      return { controls: { ...controls, objective: change.value }, clearsPlan: true };
    }

    // Clears outright for the same reason `objective` does, and one of its own: a plan built
    // under a wider setting carries chores the narrower one forbids, so leaving it on screen
    // under a "stale" banner would show a move list the current setting says the player may not
    // be given.
    case 'allowedChanges': {
      if (controls.allowedChanges === change.value) return null;
      return { controls: { ...controls, allowedChanges: change.value }, clearsPlan: true };
    }

    // Clears outright, like every other setting that reshapes the search rather than shifting
    // its numbers: this one changes what the objective MEANS, so the figures from the previous
    // run are answers to a different question, not stale answers to this one.
    case 'ignoreFieldCrowding': {
      if (controls.ignoreFieldCrowding === change.value) return null;
      return { controls: { ...controls, ignoreFieldCrowding: change.value }, clearsPlan: true };
    }

    // Clears for the same reason `ignoreFieldCrowding` does: every hit in the previous run was
    // priced against a field lit some other share of the time.
    case 'auraAtCap': {
      const next = withAuraAtCap(controls.aurasAtCap, change.auraId, change.value);
      if (next === controls.aurasAtCap) return null;
      return { controls: { ...controls, aurasAtCap: next }, clearsPlan: true };
    }

    // Clears the plan for the same reason `objective` does: the figures on screen are about one
    // phase, and re-labelling them with another is how a plan comes to describe a fight it never
    // scored. The FIRST pick of the phase the derived default already sits on must still flip
    // `targetPhaseChosen` and stop tracking the host's own farm phase, so this is not a bare
    // equality check.
    case 'targetPhase': {
      const next = clampTargetPhase(change.value);
      if (controls.targetPhase === next && controls.targetPhaseChosen) return null;
      const wasResolved = resolveTeamPlanTargetPhase(
        { farmChosenPhase: context.farmChosenPhase, phase: context.phase },
        controls,
      );
      return {
        controls: { ...controls, targetPhase: next, targetPhaseChosen: true },
        clearsPlan: wasResolved !== next,
      };
    }

    default: {
      const exhaustive: never = change;
      throw new Error(`unreachable control change: ${JSON.stringify(exhaustive)}`);
    }
  }
}
