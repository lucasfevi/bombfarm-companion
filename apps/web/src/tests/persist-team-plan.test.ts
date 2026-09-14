import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { onStorageWriteError } from '@/shared/lib/storage';
import { TEAM_PLAN_KEY, type TeamPlanEnvelope } from '@/shared/lib/team-plan-storage';
import { attachTeamPlanPersistence } from '@/shared/stores/persistence/persist-team-plan';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
import { selectTeamPlanTargetPhase } from '@/shared/stores/selectors/team-plan-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

function memoryLocalStorage(opts?: { throwOnSet?: boolean }) {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts?.throwOnSet) throw new Error('QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

const sampleItem: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

function hero(id: string) {
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
    sourceId: id,
    battleAllowed: true,
  };
}

function samplePlan(): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 1,
    slots: 3,
    currentDps: 100,
    planDps: 120,
    forgeFloorApplied: 10,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
  };
}

function bootUsableStore(booted: boolean) {
  const state = usePlannerStore.getState();
  state.hydrateRoster([hero('a')], 'a');
  state.hydrateInventory({ version: 1, importedAt: 0, items: [sampleItem] }, 10);
  state.setBooted(booted);
}

function solve(plan: TeamPlan) {
  usePlannerStore.getState().startRun('r1');
  usePlannerStore.getState().applyPlan('r1', plan);
}

function storedEnvelope(): TeamPlanEnvelope | null {
  const raw = localStorage.getItem(TEAM_PLAN_KEY);
  return raw === null ? null : (JSON.parse(raw) as TeamPlanEnvelope);
}

describe('team plan persistence subscription', () => {
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
    detach = attachTeamPlanPersistence(usePlannerStore);
  });

  afterEach(() => {
    detach();
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('writes the envelope within the autosave window when a plan lands and removes the key when the plan clears', () => {
    bootUsableStore(true);
    const plan = samplePlan();
    solve(plan);

    vi.advanceTimersByTime(AUTOSAVE_MS - 1);
    expect(localStorage.getItem(TEAM_PLAN_KEY)).toBeNull();

    vi.advanceTimersByTime(1);
    const state = usePlannerStore.getState();
    const stored = storedEnvelope();
    expect(stored?.version).toBe(1);
    expect(stored?.signature).toBe(state.planInputSignature);
    expect(stored?.objective).toBe(state.objective);
    expect(stored?.allowedChanges).toBe(state.allowedChanges);
    expect(stored?.ignoreFieldCrowding).toBe(state.ignoreFieldCrowding);
    expect(stored?.targetPhase).toBe(selectTeamPlanTargetPhase(state));
    expect(stored?.plan).toEqual(plan);

    usePlannerStore.getState().clearPlan();
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(TEAM_PLAN_KEY)).toBeNull();
  });

  it('writes nothing before the store is booted', () => {
    bootUsableStore(false);
    solve(samplePlan());

    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(usePlannerStore.getState().plan).not.toBeNull();
    expect(localStorage.getItem(TEAM_PLAN_KEY)).toBeNull();
  });

  it('a failed write reports through the storage error hook and leaves the plan in memory', () => {
    bootUsableStore(true);
    const failures: Array<{ key: string }> = [];
    const unsubscribe = onStorageWriteError(({ key }) => {
      failures.push({ key });
    });
    const plan = samplePlan();
    solve(plan);
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));

    expect(() => vi.advanceTimersByTime(AUTOSAVE_MS)).not.toThrow();
    unsubscribe();

    expect(failures).toEqual([{ key: 'bf-hp-team-plan-v1' }]);
    expect(usePlannerStore.getState().plan).toEqual(plan);
    expect(usePlannerStore.getState().runStatus).toBe('done');
  });
});
