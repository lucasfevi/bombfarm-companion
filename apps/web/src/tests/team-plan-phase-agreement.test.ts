/**
 * The Team plan scores every gear and point candidate in one `FarmContext`, and that context
 * used to be built from the account's imported phase — a value nothing in the app moves — while
 * the hero workspace and the phases explorer had already been routed onto the phase the player
 * picked. A player who picked a phase and then built a plan got it scored for a different phase
 * than every other number on screen.
 *
 * Both sides below are derived through what the screens actually call and compared to each
 * other, never to pinned figures: the plan's scoring context through the store's own input
 * builder, the other surfaces through the selector they read.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import { buildTeamPlanInputFromStore } from '@/features/team-plan/model/build-team-plan-input';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectCombatPhase,
  selectCurrentPhase,
  selectCurrentPhaseMitigationPct,
  selectPhasesViewPhase,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';

const ACCOUNT_FARM_PHASE = 300;

function hydrateOneHero(): void {
  const hero = normalizeHero({
    id: 'h1',
    name: 'Hero',
    sourceId: 'src-1',
    updatedAt: 1,
    rarity: 'Raro',
    level: 40,
    stars: 3,
    naked: {
      attack: 900,
      energy: 120,
      speed: 60,
      critChance: 12,
      critDmg: 80,
      penetration: 5,
      cdr: 10,
      luck: 0,
    },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
  usePlannerStore.getState().hydrateRoster([hero], 'h1');
  usePlannerStore.getState().applyAccountImport({
    tree: null,
    houseIdx: 0,
    houseLevel: 5,
    phase: ACCOUNT_FARM_PHASE,
  });
}

/** The phase and mitigation every roster evaluation of a plan built from this store scores in. */
function planScoringContext(state: PlannerStore): { phase: number | null; mitigationPct: number } {
  const farm = farmFromAccount(buildTeamPlanInputFromStore(state));
  return { phase: farm.phase, mitigationPct: farm.mitigationPct };
}

function resolvedContext(state: PlannerStore): { phase: number; mitigationPct: number } {
  return { phase: selectCurrentPhase(state), mitigationPct: selectCurrentPhaseMitigationPct(state) };
}

describe('the Team plan scores at the phase the other surfaces resolve to', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    hydrateOneHero();
  });

  it('scores at the phase the player picked in the explorer, with that phase’s own mitigation', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const state = usePlannerStore.getState();

    expect(planScoringContext(state)).toEqual(resolvedContext(state));
    expect(planScoringContext(state).phase).toBe(selectPhasesViewPhase(state));
    expect(planScoringContext(state).phase).not.toBe(ACCOUNT_FARM_PHASE);
  });

  it('follows a second pick, and the mitigation actually moved with it', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const atFirstPick = planScoringContext(usePlannerStore.getState());

    usePlannerStore.getState().setPhasesViewPhase(42);
    const state = usePlannerStore.getState();

    expect(planScoringContext(state)).toEqual(resolvedContext(state));
    expect(planScoringContext(state).mitigationPct).not.toBe(atFirstPick.mitigationPct);
  });

  it('answers for the account’s own farm phase until the player picks one', () => {
    const state = usePlannerStore.getState();

    expect(state.phasesViewPhaseChosen).toBe(false);
    expect(planScoringContext(state).phase).toBe(ACCOUNT_FARM_PHASE);
    expect(planScoringContext(state).phase).toBe(selectCurrentPhase(state));
    // The import stores that phase's mitigation to two decimals; the plan reads the wiki row.
    expect(planScoringContext(state).mitigationPct).toBeCloseTo(state.mitigationPct, 2);
  });

  it('the board’s auto-picked map is not a pick, and leaves the plan on the account’s phase', () => {
    usePlannerStore.getState().syncDefaultPhaseSelection(4);
    const state = usePlannerStore.getState();

    expect(selectPhasesViewPhase(state)).toBe(4);
    expect(planScoringContext(state).phase).toBe(ACCOUNT_FARM_PHASE);
    expect(planScoringContext(state).phase).toBe(selectCurrentPhase(state));
  });

  it('a phase picked on the Team plan’s own control wins over the explorer’s', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    usePlannerStore.getState().setTargetPhase(200);
    const state = usePlannerStore.getState();

    expect(planScoringContext(state)).toEqual({
      phase: 200,
      mitigationPct: wikiPhaseLine(200)!.mitig * 100,
    });
    expect(selectCurrentPhase(state)).toBe(137);
  });

  it('the Combat tab’s what-if phase moves the planner alone, as it does for the explorer', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    usePlannerStore.getState().setPlannerPhaseOverride(42);
    const state = usePlannerStore.getState();

    expect(selectCombatPhase(state)).toBe(42);
    expect(planScoringContext(state)).toEqual(resolvedContext(state));
    expect(planScoringContext(state).phase).toBe(137);
  });
});
