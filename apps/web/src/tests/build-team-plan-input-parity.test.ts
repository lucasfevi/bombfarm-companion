/**
 * Temporary parity proof for the lift of the optimizer's input builder into the shared package:
 * the store's own `buildTeamPlanInputFromStore` must still deep-equal the package's
 * `buildTeamPlanInput` composed over the two new mapping selectors, for the same store state.
 * Deleted once the store's builder becomes that two-line composition — the package's own
 * deep-equality pin is the permanent snapshot from then on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTeamPlanInput, computeTeamPlanInputSignature } from '@bombfarm/team-plan/core';
import { buildTeamPlanInputFromStore } from '@/features/team-plan/model/build-team-plan-input';
import {
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

function hero(id: string, battleAllowed = true) {
  return {
    id,
    name: id,
    updatedAt: 1,
    rarity: 'Raro' as const,
    level: 20,
    stars: 0,
    naked: {
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    loadout: {
      arma: null,
      elmo: null,
      anel: null,
      amuleto: null,
      peito: null,
      calca: null,
      luva: null,
      bota: null,
    },
    altLoadout: null,
    gearedOverride: {
      attack: 10,
      energy: 10,
      speed: 10,
      critChance: 0,
      critDmg: 10,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    abilities: {},
    pts: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    sourceId: `src-${id}`,
    battleAllowed,
  };
}

function parityHolds() {
  const state = usePlannerStore.getState();
  const fromStore = buildTeamPlanInputFromStore(state);
  const fromPackage = buildTeamPlanInput(
    selectTeamPlanInputs(state),
    selectTeamPlanControls(state),
  );
  expect(fromPackage).toEqual(fromStore);
}

describe('the package builder deep-equals the store builder', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('for a roster with a battle-disabled hero, an inventory and a stored scope choice', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b', false)], 'a');
    usePlannerStore.setState({
      scopeByHeroId: { a: 'optimize' },
      inventory: { version: 1, importedAt: 3, items: [] },
      forgeFloor: 12,
    });
    parityHolds();
  });

  it('computeTeamPlanInputSignature produces the same string as the store selector', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b', false)], 'a');
    usePlannerStore.setState({
      scopeByHeroId: { a: 'optimize' },
      inventory: { version: 1, importedAt: 3, items: [] },
      forgeFloor: 12,
    });
    const state = usePlannerStore.getState();
    const fromPackage = computeTeamPlanInputSignature(
      selectTeamPlanInputs(state),
      selectTeamPlanControls(state),
    );
    expect(fromPackage).toBe(selectLiveTeamPlanInputSignature(state));
  });

  it('for a chosen target phase', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.setState({ phase: 137 });
    usePlannerStore.getState().setTargetPhase(200);
    parityHolds();
  });

  it('for a chosen Farm-tab phase, with the target phase left on its default', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.setState({ phase: 137 });
    usePlannerStore.getState().setPhasesViewPhase(58);
    parityHolds();
  });
});
