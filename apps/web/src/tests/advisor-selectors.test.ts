import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import { emptyLoadout } from '@bombfarm/domain/gear';
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

  it('dep tuple has exactly 29 members in spec order (BSPW5-03 adds treeLuckFlatPct, birth adds birth, abisso adds treeAbisso/treeAbissoBase, unspent-points wave adds statPointsAvailable, crit_dmg_mult wave adds treeCritDmgMult)', () => {
    const tuple = readAdvisorDepTuple(usePlannerStore.getState());
    expect(tuple).toHaveLength(29);
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
