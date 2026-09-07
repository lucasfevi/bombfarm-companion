/**
 * Which phase the Team plan scores at before the player has touched the picker, and what changes
 * once they have.
 *
 * The interesting case is the Farm tab's own phase, which carries a separate "did the player
 * actually choose this" flag precisely because its unchosen default is phase 1. Reading the value
 * without the flag would silently plan every fresh account for phase 1.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetPlannerStoreForTests,
  usePlannerStore,
  selectTeamPlanTargetPhase,
  selectTeamPlanFarmUnavailable,
} from '@/shared/stores';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';

function state() {
  return usePlannerStore.getState();
}

describe('the Team plan target phase', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('falls back to the phase the save says the account is on', () => {
    usePlannerStore.setState({ phase: 137 });
    expect(selectTeamPlanTargetPhase(state())).toBe(137);
  });

  it('prefers the Farm tab phase once that was a real choice there', () => {
    usePlannerStore.setState({ phase: 137 });
    state().setPhasesViewPhase(58);
    expect(selectTeamPlanTargetPhase(state())).toBe(58);
  });

  it('ignores the Farm tab phase while it is only that tab\'s own default', () => {
    usePlannerStore.setState({ phase: 137 });
    // The board's auto-pick — a derived default, not a choice, and it must not become one here.
    state().syncDefaultPhaseSelection(4);
    expect(state().phasesViewPhase).toBe(4);
    expect(selectTeamPlanTargetPhase(state())).toBe(137);
  });

  it('a pick on this page wins over both, and None is a pick like any other', () => {
    usePlannerStore.setState({ phase: 137 });
    state().setPhasesViewPhase(58);

    state().setTargetPhase(200);
    expect(selectTeamPlanTargetPhase(state())).toBe(200);

    state().setTargetPhase(null);
    expect(selectTeamPlanTargetPhase(state())).toBeNull();
    // And it stays None even though both fallbacks still hold values.
    expect(state().phase).toBe(137);
    expect(state().phasesViewPhase).toBe(58);
  });

  it('picking a phase clears the plan on screen, the way switching objective does', () => {
    usePlannerStore.setState({
      phase: 137,
      plan: { steps: [] } as never,
      planInputSignature: 'x',
      runStatus: 'done',
      runId: 'run-1',
    });

    state().setTargetPhase(200);

    expect(state().plan).toBeNull();
    expect(state().runStatus).toBe('idle');
    expect(state().runId).toBeNull();
  });

  it('the plan signature moves with the phase, so an old plan reads as stale', () => {
    usePlannerStore.setState({ phase: 137 });
    const before = selectLiveTeamPlanInputSignature(state());
    state().setTargetPhase(200);
    expect(selectLiveTeamPlanInputSignature(state())).not.toBe(before);
  });

  it('gold scoring needs a furthest phase only while the picker sits on None', () => {
    usePlannerStore.setState({ phase: null, maxPhase: null });
    expect(selectTeamPlanTargetPhase(state())).toBeNull();
    expect(selectTeamPlanFarmUnavailable(state())).toBe(true);

    state().setTargetPhase(200);
    expect(selectTeamPlanFarmUnavailable(state())).toBe(false);

    state().setTargetPhase(null);
    expect(selectTeamPlanFarmUnavailable(state())).toBe(true);
  });

  it('clamps a phase to the wiki table rather than planning for one that does not exist', () => {
    state().setTargetPhase(9999);
    expect(selectTeamPlanTargetPhase(state())).toBe(600);
    state().setTargetPhase(0);
    expect(selectTeamPlanTargetPhase(state())).toBe(1);
  });
});
