import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPhasesView } from '@/shared/lib/phases-view-storage';
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

describe('phases slice', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    vi.unstubAllGlobals();
  });

  it('clamps setPhasesViewPhase to 1–600 and writes through', () => {
    usePlannerStore.getState().setPhasesViewPhase(0);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(1);
    expect(loadPhasesView().phase).toBe(1);

    usePlannerStore.getState().setPhasesViewPhase(999);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(600);
    expect(loadPhasesView().phase).toBe(600);

    usePlannerStore.getState().setPhasesViewPhase(42);
    expect(usePlannerStore.getState().phasesViewPhase).toBe(42);
    expect(loadPhasesView().phase).toBe(42);
  });

  it('syncDefaultPhaseSelection moves the shared phase without choosing or persisting it', () => {
    usePlannerStore.getState().syncDefaultPhaseSelection(27);

    expect(usePlannerStore.getState().phasesViewPhase).toBe(27);
    expect(usePlannerStore.getState().phasesViewPhaseChosen).toBe(false);
    expect(localStorage.getItem('bf-hp-phases-view-v1')).toBeNull();
  });

  it('syncDefaultPhaseSelection never overrides a phase the user actually picked', () => {
    usePlannerStore.getState().setPhasesViewPhase(25);
    usePlannerStore.getState().syncDefaultPhaseSelection(27);

    expect(usePlannerStore.getState().phasesViewPhase).toBe(25);
    expect(loadPhasesView().phase).toBe(25);
  });

  it('hydratePhasesView does not write', () => {
    usePlannerStore.getState().hydratePhasesView({ phase: 88 });
    expect(usePlannerStore.getState().phasesViewPhase).toBe(88);
    expect(localStorage.getItem('bf-hp-phases-view-v1')).toBeNull();
  });

  it('hydratePhasesView restores farmPool and farmReturnBonus, defaulting absent fields', () => {
    usePlannerStore
      .getState()
      .hydratePhasesView({ phase: 5, farmPool: { 'hero-1': false }, farmReturnBonus: 'vip' });
    expect(usePlannerStore.getState().farmPoolOverrides).toEqual({ 'hero-1': false });
    expect(usePlannerStore.getState().farmReturnBonus).toBe('vip');

    usePlannerStore.getState().hydratePhasesView({ phase: 6 });
    expect(usePlannerStore.getState().farmPoolOverrides).toEqual({});
    expect(usePlannerStore.getState().farmReturnBonus).toBe('off');
  });

  // Whole-state writer — red against the shipped implementation before this feature: the old
  // savePhasesView({ phase: clamped }) call site silently erased any second persisted field.
  it('a pool override survives a later setPhasesViewPhase call (whole-state writer)', () => {
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', false);
    usePlannerStore.getState().setPhasesViewPhase(151);

    expect(loadPhasesView().farmPool).toEqual({ 'hero-1': false });
    expect(loadPhasesView().phase).toBe(151);
  });

  it('the return bonus survives a later setPhasesViewPhase call (whole-state writer)', () => {
    usePlannerStore.getState().setFarmReturnBonus('vip');
    usePlannerStore.getState().setPhasesViewPhase(42);

    expect(loadPhasesView().farmReturnBonus).toBe('vip');
    expect(loadPhasesView().phase).toBe(42);
  });

  it('setFarmHeroEnabled persists additively and is a no-op write when unchanged', () => {
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', true);
    expect(usePlannerStore.getState().farmPoolOverrides).toEqual({ 'hero-1': true });
    expect(loadPhasesView().farmPool).toEqual({ 'hero-1': true });

    const before = usePlannerStore.getState().farmPoolOverrides;
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', true);
    expect(usePlannerStore.getState().farmPoolOverrides).toBe(before);
  });

  it('setFarmReturnBonus persists and is a no-op write when unchanged', () => {
    usePlannerStore.getState().setFarmReturnBonus('on');
    expect(usePlannerStore.getState().farmReturnBonus).toBe('on');
    expect(loadPhasesView().farmReturnBonus).toBe('on');

    usePlannerStore.getState().setFarmReturnBonus('on');
    expect(usePlannerStore.getState().farmReturnBonus).toBe('on');
  });

  it('the persisted payload never carries the ephemeral fields', () => {
    // No setPhasesViewPhase call in this test, so the phase is still unchosen — `phase`
    // itself is correctly omitted here too (see the "omits phase while unchosen" test below).
    usePlannerStore.getState().setFarmReturnBonus('vip');
    const raw = JSON.parse(localStorage.getItem('bf-hp-phases-view-v1')!) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['farmPool', 'farmReturnBonus']);
  });

  it('omits phase while unchosen, so a later write cannot freeze the auto-select onto phase 1', () => {
    usePlannerStore.getState().setFarmHeroEnabled('hero-1', true);
    const raw = JSON.parse(localStorage.getItem('bf-hp-phases-view-v1')!) as Record<string, unknown>;
    expect('phase' in raw).toBe(false);

    usePlannerStore.getState().setPhasesViewPhase(7);
    const afterChoice = JSON.parse(localStorage.getItem('bf-hp-phases-view-v1')!) as Record<string, unknown>;
    expect(afterChoice.phase).toBe(7);
  });

  it('setPhasesViewPhase(1) on a fresh, unchosen store still marks the phase chosen and persists it', () => {
    expect(usePlannerStore.getState().phasesViewPhaseChosen).toBe(false);
    usePlannerStore.getState().setPhasesViewPhase(1);
    expect(usePlannerStore.getState().phasesViewPhaseChosen).toBe(true);
    expect(loadPhasesView().phase).toBe(1);
  });
});
