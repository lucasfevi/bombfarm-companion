import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { selectTeamPlanIsStale } from '@/shared/stores/selectors/team-plan-selectors';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';
import { DEFAULT_TEAM_PLAN_OBJECTIVE } from '@/shared/stores/team-plan/types';
import * as storage from '@/shared/lib/storage';
import * as i18n from '@/shared/i18n';
import * as phasesView from '@/shared/lib/phases-view-storage';
import { TEAM_PLAN_KEY, type TeamPlanEnvelope } from '@/shared/lib/team-plan-storage';

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

function heroJson(id: string, sourceId: string) {
  return {
    id,
    name: id,
    sourceId,
    updatedAt: 1,
    rarity: 'Raro' as const,
    level: 1,
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

function envelopeFor(signature: string, overrides: Partial<TeamPlanEnvelope> = {}): TeamPlanEnvelope {
  return {
    version: 1,
    signature,
    objective: DEFAULT_TEAM_PLAN_OBJECTIVE,
    allowedChanges: 'both',
    ignoreFieldCrowding: false,
    targetPhase: null,
    plan: samplePlan(),
    ...overrides,
  };
}

function seedRosterAndAccount() {
  localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
  localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
  localStorage.setItem(
    'bf-hp-account-v1',
    JSON.stringify({
      tree: storage.DEFAULT_TREE(),
      teamBuffs: {},
      context: storage.DEFAULT_CONTEXT(),
    }),
  );
}

function liveSignatureAfterBoot(): string {
  hydratePlannerStore();
  const signature = selectLiveTeamPlanInputSignature(usePlannerStore.getState());
  resetPlannerStoreForTests();
  return signature;
}

describe('hydratePlannerStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads in order: heroes → active → account → lang → phases; setBooted last', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: storage.DEFAULT_TREE(),
        teamBuffs: {},
        context: storage.DEFAULT_CONTEXT(),
      }),
    );
    localStorage.setItem('bf_lang', 'en');
    localStorage.setItem('bf-hp-phases-view-v1', JSON.stringify({ phase: 12 }));

    const order: string[] = [];
    vi.spyOn(storage, 'loadHeroes').mockImplementation(() => {
      order.push('heroes');
      return [storage.normalizeHero(heroJson('a', 's-a'))];
    });
    vi.spyOn(storage, 'getActiveHeroId').mockImplementation(() => {
      order.push('active');
      return 'a';
    });
    vi.spyOn(storage, 'loadAccountShared').mockImplementation(() => {
      order.push('account');
      return storage.DEFAULT_ACCOUNT();
    });
    vi.spyOn(i18n, 'loadLang').mockImplementation(() => {
      order.push('lang');
      return 'en';
    });
    vi.spyOn(phasesView, 'loadPhasesView').mockImplementation(() => {
      order.push('phases');
      return { phase: 12 };
    });

    hydratePlannerStore();
    expect(order).toEqual(['heroes', 'active', 'account', 'lang', 'phases']);
    expect(usePlannerStore.getState().booted).toBe(true);
    expect(usePlannerStore.getState().lang).toBe('en');
    expect(usePlannerStore.getState().phasesViewPhase).toBe(12);
    expect(usePlannerStore.getState().activeHeroId).toBe('a');
  });

  it('second call is a no-op with no localStorage reads', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: storage.DEFAULT_TREE(),
        teamBuffs: {},
        context: storage.DEFAULT_CONTEXT(),
      }),
    );
    hydratePlannerStore();
    const getItem = vi.spyOn(localStorage, 'getItem');
    const before = usePlannerStore.getState();
    hydratePlannerStore();
    expect(usePlannerStore.getState()).toBe(before);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('clean load (sourceId + account present) performs zero setItem, aside from the two one-shot flat-migration markers', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([heroJson('a', 's-a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: storage.DEFAULT_TREE(),
        teamBuffs: {},
        context: storage.DEFAULT_CONTEXT(),
      }),
    );
    localStorage.setItem('bf_lang', 'pt');
    localStorage.setItem('bf-hp-phases-view-v1', JSON.stringify({ phase: 1 }));

    const setItem = vi.spyOn(localStorage, 'setItem');
    hydratePlannerStore();
    // The THREE one-shot migration markers (`bf-hp-critdmg-flat-migrated-v1` for crit damage at
    // the 2026-08-13 patch, `bf-hp-critchance-flat-migrated-v1` for crit chance/CDR going flat
    // at the 2026-08-15 one, `bf-hp-critcdr-repool-migrated-v1` for the 2026-08-18 revert back
    // to percent-of-base, issue #132) are each written unconditionally the first time they are
    // absent — see `migrateCritDmgFlatBakeOnce` / `migrateCritChanceFlatBakeOnce` /
    // `migrateCritCdrRepoolBakeOnce` for why that cannot be deferred until content actually
    // needs converting. No hero here has Golpe Brutal or Olho Clínico, so those three are the
    // ONLY setItems this otherwise-clean load makes.
    expect(setItem).toHaveBeenCalledTimes(3);
    expect(setItem).toHaveBeenCalledWith('bf-hp-critdmg-flat-migrated-v1', 'true');
    expect(setItem).toHaveBeenCalledWith('bf-hp-critchance-flat-migrated-v1', 'true');
    expect(setItem).toHaveBeenCalledWith('bf-hp-critcdr-repool-migrated-v1', 'true');
  });

  it('restores a plan whose controls match, as current when its signature matches the live one and as stale when it does not', () => {
    seedRosterAndAccount();
    const liveSignature = liveSignatureAfterBoot();

    const current = envelopeFor(liveSignature);
    localStorage.setItem(TEAM_PLAN_KEY, JSON.stringify(current));
    hydratePlannerStore();
    let state = usePlannerStore.getState();
    expect(state.plan).toEqual(current.plan);
    expect(state.runStatus).toBe('done');
    expect(state.runId).toBeNull();
    expect(state.planInputSignature).toBe(liveSignature);
    expect(selectTeamPlanIsStale(state)).toBe(false);

    resetPlannerStoreForTests();
    const stale = envelopeFor(`${liveSignature}-but-older`);
    localStorage.setItem(TEAM_PLAN_KEY, JSON.stringify(stale));
    hydratePlannerStore();
    state = usePlannerStore.getState();
    expect(state.plan).toEqual(stale.plan);
    expect(state.runStatus).toBe('done');
    expect(selectTeamPlanIsStale(state)).toBe(true);
  });

  it('drops a plan solved under different controls and removes its key', () => {
    seedRosterAndAccount();
    const liveSignature = liveSignatureAfterBoot();
    const otherObjective = DEFAULT_TEAM_PLAN_OBJECTIVE === 'dps' ? 'farm' : 'dps';
    localStorage.setItem(
      TEAM_PLAN_KEY,
      JSON.stringify(envelopeFor(liveSignature, { objective: otherObjective })),
    );

    hydratePlannerStore();
    const state = usePlannerStore.getState();
    expect(state.plan).toBeNull();
    expect(state.runStatus).toBe('idle');
    expect(localStorage.getItem('bf-hp-team-plan-v1')).toBeNull();
  });

  it('restores after the scope map, so the inventory hydration cannot clear it', () => {
    seedRosterAndAccount();
    localStorage.setItem(
      'bf-hp-inventory-v1',
      JSON.stringify({
        version: 1,
        importedAt: 5,
        items: [
          {
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
          },
        ],
      }),
    );
    const envelope = envelopeFor(liveSignatureAfterBoot());
    localStorage.setItem(TEAM_PLAN_KEY, JSON.stringify(envelope));

    hydratePlannerStore();
    const state = usePlannerStore.getState();
    expect(state.inventory.items).toHaveLength(1);
    expect(state.plan).toEqual(envelope.plan);
    expect(state.runStatus).toBe('done');
  });
});
