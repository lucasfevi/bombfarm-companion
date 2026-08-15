import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { houseRestSeconds } from '@bombfarm/domain/model';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { normalizeHero } from '@/shared/lib/storage';
import {
  getAdvisorPipelineComputeCount,
  readAdvisorDepTuple,
  resetAdvisorPipelineComputeCount,
  selectAdvisorPipeline,
  selectDps,
} from '@/shared/stores/selectors/advisor-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

describe('selectAdvisorPipeline', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineComputeCount();
    resetEnergySwitchPointCallCount();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineComputeCount();
    resetEnergySwitchPointCallCount();
  });

  it('returns cached reference when deps unchanged (N invocations → 1 compute)', () => {
    const s = usePlannerStore.getState();
    const a = selectAdvisorPipeline(s);
    const b = selectAdvisorPipeline(s);
    const c = selectAdvisorPipeline(s);
    expect(getAdvisorPipelineComputeCount()).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('recomputes exactly once when any dep tuple member changes', () => {
    selectAdvisorPipeline(usePlannerStore.getState());
    usePlannerStore.getState().setHeroLevel(5);
    selectAdvisorPipeline(usePlannerStore.getState());
    expect(getAdvisorPipelineComputeCount()).toBe(2);
  });

  it('heroName write leaves compute count and energySwitchPoint unchanged (P-01 proxy)', () => {
    selectAdvisorPipeline(usePlannerStore.getState());
    const computeBefore = getAdvisorPipelineComputeCount();
    const espBefore = energySwitchPointCallCount;
    usePlannerStore.getState().setHeroName('Renamed');
    selectAdvisorPipeline(usePlannerStore.getState());
    expect(getAdvisorPipelineComputeCount()).toBe(computeBefore);
    expect(energySwitchPointCallCount).toBe(espBefore);
  });

  it('toast write leaves compute count unchanged', () => {
    selectAdvisorPipeline(usePlannerStore.getState());
    const before = getAdvisorPipelineComputeCount();
    usePlannerStore.getState().flashToast('hello');
    selectAdvisorPipeline(usePlannerStore.getState());
    expect(getAdvisorPipelineComputeCount()).toBe(before);
  });

  it('dep tuple has exactly 26 members in spec order (MP5 F3 dropped the 5 keystone-derived entries and statPointsAvailable; the House-ceiling fix added houseCycleSecs, and its regression repair added houseCycleSecsHouseIdx/houseCycleSecsLevel — pipeline inputs, so an edit to any MUST recompute)', () => {
    const tuple = readAdvisorDepTuple(usePlannerStore.getState());
    expect(tuple).toHaveLength(26);
  });

  it('selectDps stays stable when heroName changes', () => {
    selectAdvisorPipeline(usePlannerStore.getState());
    const dpsBefore = selectDps(usePlannerStore.getState());
    usePlannerStore.getState().setHeroName('Renamed');
    expect(selectDps(usePlannerStore.getState())).toBe(dpsBefore);
    expect(getAdvisorPipelineComputeCount()).toBe(1);
  });

  it('persistence modules do not import advisor selectors (W5-08)', () => {
    const dir = join(WEB_PACKAGE_ROOT, 'src/shared/stores/persistence');
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts')) continue;
      const content = readFileSync(join(dir, file), 'utf8');
      expect(content).not.toMatch(/advisor-selectors/);
      expect(content).not.toMatch(/selectAdvisorPipeline/);
    }
  });
});

describe('selectAdvisorPipeline with hydrated hero', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineComputeCount();
    const h = normalizeHero({
      id: 'h1',
      name: 'Hero',
      sourceId: 'src-1',
      updatedAt: 1,
      rarity: 'Raro',
      level: 10,
      stars: 1,
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
      loadout: emptyLoadout(),
      pts: ZERO_PTS(),
    });
    usePlannerStore.getState().hydrateRoster([h], 'h1');
    usePlannerStore.getState().applyHero(h);
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineComputeCount();
  });

  it('identity guard on object fields prevents recompute on equal write', () => {
    selectAdvisorPipeline(usePlannerStore.getState());
    const before = getAdvisorPipelineComputeCount();
    const naked = usePlannerStore.getState().naked;
    usePlannerStore.getState().setNaked(naked);
    selectAdvisorPipeline(usePlannerStore.getState());
    expect(getAdvisorPipelineComputeCount()).toBe(before);
  });
});

describe('selectAdvisorPipeline House-ceiling anchor regression (PR #86, house.ts:38)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineComputeCount();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineComputeCount();
  });

  it('requested house/level EQUAL the account\'s own import → the exact save figure (account 486)', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: null,
      houseIdx: 0,
      houseLevel: 11,
      houseCycleSecs: 1168.42105263158,
      phase: null,
    });
    expect(selectAdvisorPipeline(usePlannerStore.getState()).rest).toBeCloseTo(
      1168.42105263158,
      9,
    );
  });

  it('a House-picker move away from the import — table fallback, and the value actually changes (was frozen before the fix)', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: null,
      houseIdx: 0,
      houseLevel: 11,
      houseCycleSecs: 1168.42105263158,
      phase: null,
    });
    const atImport = selectAdvisorPipeline(usePlannerStore.getState()).rest;

    usePlannerStore.getState().setHouseIdx(4);
    const afterHouseSwitch = selectAdvisorPipeline(usePlannerStore.getState()).rest;
    expect(afterHouseSwitch).toBe(houseRestSeconds(4, 11));
    expect(afterHouseSwitch).not.toBeCloseTo(atImport, 0);
  });

  it('a House-LEVEL-picker move away from the import (same house) — table fallback, and the value changes', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: null,
      houseIdx: 0,
      houseLevel: 11,
      houseCycleSecs: 1168.42105263158,
      phase: null,
    });
    const atImport = selectAdvisorPipeline(usePlannerStore.getState()).rest;

    usePlannerStore.getState().setHouseLevel(1);
    const afterLevelSwitch = selectAdvisorPipeline(usePlannerStore.getState()).rest;
    expect(afterLevelSwitch).toBe(houseRestSeconds(0, 1));
    expect(afterLevelSwitch).not.toBeCloseTo(atImport, 0);
  });

  it('no casa in the import payload — pure table path, unchanged behaviour', () => {
    usePlannerStore.getState().applyAccountImport({
      tree: null,
      houseIdx: null,
      houseLevel: null,
      phase: null,
    });
    usePlannerStore.getState().setHouseIdx(2);
    usePlannerStore.getState().setHouseLevel(9);
    expect(selectAdvisorPipeline(usePlannerStore.getState()).rest).toBe(houseRestSeconds(2, 9));
  });
});
