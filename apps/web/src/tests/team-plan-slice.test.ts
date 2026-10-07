import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { attachInventoryPersistence } from '@/shared/stores/persistence/persist-inventory';
import { attachTeamPlanScopePersistence } from '@/shared/stores/persistence/persist-team-plan-scope';
import { AUTOSAVE_MS } from '@/shared/stores/persistence/debounced-writer';
import { hydratePlannerStore } from '@/shared/stores/hydrate-planner-store';
import { selectTeamPlanIsStale } from '@/shared/stores/selectors/team-plan-selectors';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';
import { buildDefaultScopeMap, resolveHeroScope } from '@/shared/stores/team-plan/types';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { INVENTORY_KEY } from '@/shared/lib/inventory-storage';
import { LEGACY_TEAM_PLAN_SCOPE_KEY, TEAM_PLAN_SCOPE_KEY } from '@/shared/lib/team-plan-scope-storage';

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
    sourceId: id,
    battleAllowed,
  };
}

describe('team-plan slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('defaults battleAllowed false heroes to donate scope', () => {
    const scope = buildDefaultScopeMap([
      { id: 'a', battleAllowed: true },
      { id: 'b', battleAllowed: false },
    ]);
    expect(scope).toEqual({ a: 'optimize', b: 'donate' });
  });

  it('hydrateInventory loads snapshot and forge floor', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory(
      { version: 1, importedAt: 5, items: [sampleItem] },
      12,
    );
    const state = usePlannerStore.getState();
    expect(state.inventory.items).toEqual([sampleItem]);
    expect(state.forgeFloor).toBe(12);
    expect(state.scopeByHeroId).toEqual({});
  });

  it('replaceInventoryFromImport clears plan state', () => {
    usePlannerStore.setState({ planInputSignature: 'old', runStatus: 'done', runId: '1' });
    usePlannerStore.getState().replaceInventoryFromImport([sampleItem]);
    const state = usePlannerStore.getState();
    expect(state.inventory.items).toEqual([sampleItem]);
    expect(state.plan).toBeNull();
    expect(state.planInputSignature).toBeNull();
    expect(state.runStatus).toBe('idle');
    expect(state.runId).toBeNull();
  });

  it('setScope no-op preserves scope map identity', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    const before = usePlannerStore.getState().scopeByHeroId;
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    expect(usePlannerStore.getState().scopeByHeroId).toBe(before);
  });

  it('setScope updates scope for a hero', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    expect(usePlannerStore.getState().scopeByHeroId.a).toBe('leaveAlone');
  });

  // A moved-to-Donate hero must not linger in the results the way "stale" inputs (forge floor,
  // points) do — the old plan's per-hero rows, proposed items, and battle load still reference
  // that hero, which reads as "still counted" rather than "needs a re-run."
  it('setScope clears an existing plan when the scope actually changes', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.setState({
      plan: {} as never,
      planInputSignature: 'sig',
      runStatus: 'done',
      runId: 'run-1',
    });
    usePlannerStore.getState().setScope('a', 'donate');
    const state = usePlannerStore.getState();
    expect(state.plan).toBeNull();
    expect(state.planInputSignature).toBeNull();
    expect(state.runStatus).toBe('idle');
    expect(state.runId).toBeNull();
  });

  it('setScope no-op leaves an existing plan untouched', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.setState({
      plan: {} as never,
      planInputSignature: 'sig',
      runStatus: 'done',
      runId: 'run-1',
    });
    usePlannerStore.getState().setScope('a', 'optimize');
    const state = usePlannerStore.getState();
    expect(state.plan).not.toBeNull();
    expect(state.planInputSignature).toBe('sig');
  });

  it('hydrateScope keeps persisted choices as they are and adds no defaults', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b'), hero('c', false)], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().hydrateScope({ a: 'donate', b: 'leaveAlone' });
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'donate', b: 'leaveAlone' });
  });

  it('hydrateScope ignores persisted entries for heroes no longer on the roster', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().hydrateScope({ a: 'leaveAlone', ghost: 'donate' });
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'leaveAlone' });
  });

  it('hydrateScope can clean a materialised map: defaults and Donate on a battle-enabled hero go, other choices stay', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b'), hero('c', false), hero('d', false)], 'a');
    usePlannerStore.getState().hydrateScope(
      { a: 'optimize', b: 'donate', c: 'donate', d: 'optimize' },
      { dropMaterialisedDefaults: true },
    );
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ d: 'optimize' });
  });

  it('setScope stores only the moved hero, not the other heroes defaults', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b', false), hero('c')], 'a');
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'leaveAlone' });
  });

  it('a hero whose battle is turned back on resolves to optimize after another hero was dragged', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b', false)], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    usePlannerStore.getState().setHeroes([hero('a'), hero('b', true)]);
    const state = usePlannerStore.getState();
    const b = state.heroes.find((candidate) => candidate.id === 'b')!;
    expect(resolveHeroScope(b, state.scopeByHeroId)).toBe('optimize');
  });

  it('a drag to the hero default column is stored and survives a later battle toggle', () => {
    usePlannerStore.getState().hydrateRoster([hero('a', false)], 'a');
    usePlannerStore.getState().setScope('a', 'donate');
    usePlannerStore.getState().setHeroes([hero('a', true)]);
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'donate' });
  });

  it('syncScopeForRoster adds no entries for new heroes and keeps prior choices', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    usePlannerStore.getState().setHeroes([hero('a'), hero('b', false)]);
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'leaveAlone' });
  });

  it('syncScopeForRoster does not reset an explicit Optimize on a battle-disabled hero', () => {
    usePlannerStore.getState().hydrateRoster([hero('a', false)], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 0, items: [] }, 10);
    usePlannerStore.getState().setScope('a', 'optimize');
    usePlannerStore.getState().syncScopeForRoster();
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'optimize' });
  });

  it('syncScopeForRoster drops the choice of a hero that left the roster', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b')], 'a');
    usePlannerStore.getState().setScope('b', 'leaveAlone');
    usePlannerStore.getState().setHeroes([hero('a')]);
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({});
  });

  it('the live plan signature is the same whether the scope map is materialised or sparse', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b', false)], 'a');
    usePlannerStore.setState({ scopeByHeroId: { a: 'optimize', b: 'donate' } });
    const materialised = selectLiveTeamPlanInputSignature(usePlannerStore.getState());
    usePlannerStore.setState({ scopeByHeroId: {} });
    expect(selectLiveTeamPlanInputSignature(usePlannerStore.getState())).toBe(materialised);
  });

  it('setForgeFloor clamps to 0…FORJA_MAX', () => {
    usePlannerStore.getState().setForgeFloor(99);
    expect(usePlannerStore.getState().forgeFloor).toBe(FORJA_MAX);
    usePlannerStore.getState().setForgeFloor(-1);
    expect(usePlannerStore.getState().forgeFloor).toBe(0);
  });

  it('setForgeFloor no-op when value unchanged', () => {
    usePlannerStore.getState().setForgeFloor(10);
    const before = usePlannerStore.getState().forgeFloor;
    usePlannerStore.getState().setForgeFloor(10);
    expect(usePlannerStore.getState().forgeFloor).toBe(before);
  });

  it('objective defaults to farm — the domain keeps dps, this app asks for gold', () => {
    expect(usePlannerStore.getState().objective).toBe('farm');
  });

  it('setObjective drops a displayed plan and disowns the run that produced it', () => {
    usePlannerStore.setState({
      plan: { steps: [] } as never,
      planInputSignature: 'sig',
      runId: 'run-1',
      runStatus: 'done',
    });
    usePlannerStore.getState().setObjective('dps');
    expect(usePlannerStore.getState().objective).toBe('dps');
    expect(usePlannerStore.getState().plan).toBeNull();
    expect(usePlannerStore.getState().planInputSignature).toBeNull();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
  });

  it('setObjective is a no-op when the objective is unchanged', () => {
    usePlannerStore.setState({ planInputSignature: 'sig', runId: 'run-1', runStatus: 'done' });
    usePlannerStore.getState().setObjective('farm');
    expect(usePlannerStore.getState().planInputSignature).toBe('sig');
    expect(usePlannerStore.getState().runId).toBe('run-1');
  });

  it('the objective is part of the plan input signature', () => {
    const farmSignature = selectLiveTeamPlanInputSignature(usePlannerStore.getState());
    usePlannerStore.getState().setObjective('dps');
    expect(selectLiveTeamPlanInputSignature(usePlannerStore.getState())).not.toBe(farmSignature);
  });

  it('farmSet defaults to no set; a pick under Set farm drops the plan, and joins the signature', () => {
    expect(usePlannerStore.getState().farmSet).toBeNull();
    usePlannerStore.getState().setObjective('setFarm');
    const noSet = selectLiveTeamPlanInputSignature(usePlannerStore.getState());
    usePlannerStore.setState({ plan: { steps: [] } as never, planInputSignature: 'sig', runId: 'run-1', runStatus: 'done' });
    usePlannerStore.getState().setFarmSet('clay');
    expect(usePlannerStore.getState().farmSet).toBe('clay');
    expect(usePlannerStore.getState().plan).toBeNull();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(selectLiveTeamPlanInputSignature(usePlannerStore.getState())).not.toBe(noSet);
  });

  it('a set picked under another objective is remembered without touching the plan', () => {
    usePlannerStore.setState({ planInputSignature: 'sig', runId: 'run-1', runStatus: 'done' });
    usePlannerStore.getState().setFarmSet('clay');
    expect(usePlannerStore.getState().farmSet).toBe('clay');
    expect(usePlannerStore.getState().runId).toBe('run-1');
    usePlannerStore.getState().setFarmSet('not-a-set');
    expect(usePlannerStore.getState().farmSet).toBeNull();
  });

  it('allowedChanges defaults to both', () => {
    expect(usePlannerStore.getState().allowedChanges).toBe('both');
  });

  it('setAllowedChanges drops a displayed plan and disowns the run that produced it', () => {
    usePlannerStore.setState({
      plan: { steps: [] } as never,
      planInputSignature: 'sig',
      runId: 'run-1',
      runStatus: 'done',
    });
    usePlannerStore.getState().setAllowedChanges('points');
    expect(usePlannerStore.getState().allowedChanges).toBe('points');
    expect(usePlannerStore.getState().plan).toBeNull();
    expect(usePlannerStore.getState().planInputSignature).toBeNull();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
  });

  it('setAllowedChanges is a no-op when the setting is unchanged', () => {
    usePlannerStore.setState({ planInputSignature: 'sig', runId: 'run-1', runStatus: 'done' });
    usePlannerStore.getState().setAllowedChanges('both');
    expect(usePlannerStore.getState().planInputSignature).toBe('sig');
    expect(usePlannerStore.getState().runId).toBe('run-1');
  });

  it('allowedChanges is part of the plan input signature', () => {
    const bothSignature = selectLiveTeamPlanInputSignature(usePlannerStore.getState());
    usePlannerStore.getState().setAllowedChanges('gear');
    expect(selectLiveTeamPlanInputSignature(usePlannerStore.getState())).not.toBe(bothSignature);
  });

  it('startRun and resolveRun track run id', () => {
    usePlannerStore.getState().startRun('run-1');
    expect(usePlannerStore.getState().runStatus).toBe('running');
    usePlannerStore.getState().resolveRun('run-1', 'done');
    expect(usePlannerStore.getState().runStatus).toBe('done');
    usePlannerStore.getState().resolveRun('stale', 'error');
    expect(usePlannerStore.getState().runStatus).toBe('done');
  });

  it('startRun freezes the roster the run is solved from, so a later roster change does not re-label the rows', () => {
    usePlannerStore.getState().hydrateRoster([hero('a'), hero('b')], 'a');
    usePlannerStore.getState().startRun('run-1');
    const frozen = usePlannerStore.getState().planHeroes;
    expect(frozen?.map((h) => h.id)).toEqual(['a', 'b']);
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    expect(usePlannerStore.getState().planHeroes).toBe(frozen);
  });

  it('the rows the player opens survive until a new plan lands, which opens the default again', () => {
    usePlannerStore.getState().startRun('run-1');
    usePlannerStore.getState().setOpenHeroIds(['b', 'c']);
    expect(usePlannerStore.getState().openHeroIds).toEqual(['b', 'c']);
    usePlannerStore.getState().applyPlan('run-1', { perHero: [] } as never);
    expect(usePlannerStore.getState().openHeroIds).toBeNull();
  });

  it('clearPlan resets plan markers', () => {
    usePlannerStore.setState({ planInputSignature: 'sig', runId: '1', runStatus: 'done', planHeroes: [], openHeroIds: ['a'] });
    usePlannerStore.getState().clearPlan();
    expect(usePlannerStore.getState().planInputSignature).toBeNull();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
    expect(usePlannerStore.getState().planHeroes).toBeNull();
    expect(usePlannerStore.getState().openHeroIds).toBeNull();
  });

  it('clearPlan resets a running search with no plan yet', () => {
    usePlannerStore.setState({ plan: null, planInputSignature: null, runId: 'run-cancel', runStatus: 'running' });
    usePlannerStore.getState().clearPlan();
    expect(usePlannerStore.getState().runId).toBeNull();
    expect(usePlannerStore.getState().runStatus).toBe('idle');
  });

  it('selectTeamPlanIsStale is false without a stored signature', () => {
    expect(selectTeamPlanIsStale(usePlannerStore.getState())).toBe(false);
  });

  it('selectTeamPlanIsStale becomes true when inputs drift', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    usePlannerStore.getState().hydrateInventory({ version: 1, importedAt: 1, items: [] }, 10);
    const signature = selectLiveTeamPlanInputSignature(usePlannerStore.getState());
    usePlannerStore.setState({ planInputSignature: signature });
    usePlannerStore.getState().setForgeFloor(11);
    expect(selectTeamPlanIsStale(usePlannerStore.getState())).toBe(true);
  });

  it('hydratePlannerStore loads inventory without writing on a clean load', () => {
    localStorage.setItem(
      'bf-hp-heroes-v1',
      JSON.stringify([hero('a')]),
    );
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      'bf-hp-account-v1',
      JSON.stringify({
        tree: {
          danoTotal: 1,
          critChance: 0,
          critDmg: 0,
          speed: 0,
          energy: 0,
          teamCoinPct: 0,
        },
        teamBuffs: {},
        context: {
          houseIdx: 0,
          houseLevel: 1,
          phase: null,
          mitigationPct: 1,
          rankMode: 'dps',
          targetProp: 'stone',
        },
        forgeFloor: 10,
      }),
    );
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify({ version: 1, importedAt: 7, items: [sampleItem] }),
    );
    const setItem = vi.spyOn(localStorage, 'setItem');
    hydratePlannerStore();
    expect(usePlannerStore.getState().inventory.items).toEqual([sampleItem]);
    // The THREE one-shot migration markers (crit damage, 2026-08-13 patch; crit chance/CDR
    // going flat, 2026-08-15 patch; the 2026-08-18 revert back to percent-of-base, issue #132)
    // are each written unconditionally the first time they are absent — see
    // `migrateCritDmgFlatBakeOnce` / `migrateCritChanceFlatBakeOnce` /
    // `migrateCritCdrRepoolBakeOnce`. No hero here has Golpe Brutal or Olho Clínico, so those
    // three are the ONLY setItems this otherwise-clean load makes.
    expect(setItem).toHaveBeenCalledTimes(3);
    expect(setItem).toHaveBeenCalledWith('bf-hp-critdmg-flat-migrated-v1', 'true');
    expect(setItem).toHaveBeenCalledWith('bf-hp-critchance-flat-migrated-v1', 'true');
    expect(setItem).toHaveBeenCalledWith('bf-hp-critcdr-repool-migrated-v1', 'true');
  });

  it('inventory persistence writes after boot and debounce', () => {
    const detach = attachInventoryPersistence(usePlannerStore);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().replaceInventoryFromImport([sampleItem]);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(INVENTORY_KEY)).toBeTruthy();
    detach();
  });

  it('inventory persistence does not write before boot', () => {
    attachInventoryPersistence(usePlannerStore);
    usePlannerStore.getState().replaceInventoryFromImport([sampleItem]);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(INVENTORY_KEY)).toBeNull();
  });

  it('team-plan scope persists after boot and debounce', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    const detach = attachTeamPlanScopePersistence(usePlannerStore);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(JSON.parse(localStorage.getItem(TEAM_PLAN_SCOPE_KEY) ?? '{}')).toEqual({
      a: 'leaveAlone',
    });
    detach();
  });

  it('team-plan scope persistence does not write before boot', () => {
    usePlannerStore.getState().hydrateRoster([hero('a')], 'a');
    attachTeamPlanScopePersistence(usePlannerStore);
    usePlannerStore.getState().setScope('a', 'leaveAlone');
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(localStorage.getItem(TEAM_PLAN_SCOPE_KEY)).toBeNull();
  });

  it('explicit Donate and Leave alone choices survive a persist and reload', () => {
    const roster = [hero('a'), hero('b'), hero('c')];
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify(roster));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    usePlannerStore.getState().hydrateRoster(roster, 'a');
    const detach = attachTeamPlanScopePersistence(usePlannerStore);
    usePlannerStore.getState().setBooted(true);
    usePlannerStore.getState().setScope('a', 'donate');
    usePlannerStore.getState().setScope('b', 'leaveAlone');
    vi.advanceTimersByTime(AUTOSAVE_MS);
    detach();
    expect(JSON.parse(localStorage.getItem(TEAM_PLAN_SCOPE_KEY) ?? '{}')).toEqual({ a: 'donate', b: 'leaveAlone' });
    resetPlannerStoreForTests();
    hydratePlannerStore();
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'donate', b: 'leaveAlone' });
  });

  it('boot cleans a materialised legacy map once and rewrites it under the new key', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([hero('a'), hero('b'), hero('c', false), hero('d')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(
      LEGACY_TEAM_PLAN_SCOPE_KEY,
      JSON.stringify({ a: 'optimize', b: 'donate', c: 'donate', d: 'leaveAlone' }),
    );
    hydratePlannerStore();
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ d: 'leaveAlone' });
    expect(JSON.parse(localStorage.getItem(TEAM_PLAN_SCOPE_KEY) ?? 'null')).toEqual({ d: 'leaveAlone' });
    expect(localStorage.getItem(LEGACY_TEAM_PLAN_SCOPE_KEY)).toBeNull();
  });

  it('boot leaves a map under the new key untouched, even one that looks materialised', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([hero('a'), hero('b')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(TEAM_PLAN_SCOPE_KEY, JSON.stringify({ a: 'optimize', b: 'donate' }));
    hydratePlannerStore();
    expect(usePlannerStore.getState().scopeByHeroId).toEqual({ a: 'optimize', b: 'donate' });
  });

  it('a reload restores a scope choice made before the previous reload', () => {
    localStorage.setItem('bf-hp-heroes-v1', JSON.stringify([hero('a')]));
    localStorage.setItem('bf-hp-active-hero-v1', JSON.stringify('a'));
    localStorage.setItem(TEAM_PLAN_SCOPE_KEY, JSON.stringify({ a: 'leaveAlone' }));
    hydratePlannerStore();
    expect(usePlannerStore.getState().scopeByHeroId.a).toBe('leaveAlone');
  });
});
