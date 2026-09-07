import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { STRINGS } from '@/shared/i18n';
import { normalizeAccount, normalizeHero } from '@/shared/lib/storage';
import {
  resetAdvisorPipelineCache,
  resetPlannerStoreForTests,
  selectAdvisorPipeline,
  selectPointsTabStatus,
  usePlannerStore,
} from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * Same dump used by the Points / strip e2e: all points in CDR on seeded Cora stats fires
 * the Tier-1 reset gate; the selector tests below assert chrome around that gate.
 */
function firingCora(battleAllowed = true) {
  return normalizeHero({
    id: 'seed-cora',
    name: 'Cora',
    sourceId: '1001',
    updatedAt: 1,
    rarity: 'Raro',
    level: 38,
    stars: 2,
    rank: 'S',
    power: 13133,
    battleAllowed,
    naked: {
      attack: 1470.4,
      energy: 836.4,
      speed: 50.3,
      critChance: 0.127,
      critDmg: 1.6236,
      penetration: 1.1,
      cdr: 0.0314,
      luck: 0,
    },
    gearedOverride: {
      attack: 1470.4,
      energy: 836.4,
      speed: 50.3,
      critChance: 0.127,
      critDmg: 1.6236,
      penetration: 1.1,
      cdr: 0.0314,
      luck: 0,
    },
    loadout: emptyLoadout(),
    abilities: { detonacao_dupla: 10, passagem_bastao: 10 },
    pts: { ...ZERO_PTS(), cdr: 38 },
  });
}

describe('disabled heroes and automatic respec advice', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineCache();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetAdvisorPipelineCache();
  });

  function hydrateFiringCora(battleAllowed = true) {
    const hero = firingCora(battleAllowed);
    usePlannerStore.getState().hydrateRoster([hero], 'seed-cora');
    usePlannerStore.getState().hydrateAccount(
      normalizeAccount({
        tree: {
          danoTotal: 1.96,
          critChance: 0.51,
          critDmg: 0.19,
          speed: 0.027,
          energy: 0.52,
          teamCoinPct: 0,
        },
        teamBuffs: {},
        context: {
          houseIdx: 2,
          houseLevel: 6,
          phase: 1,
          mitigationPct: 1,
          cycleModel: 'serial',
          walkDelay: 0.15,
          extraDmgPct: 0,
          rankMode: 'dps',
          targetProp: 'bush',
        },
      }),
    );
    usePlannerStore.getState().hydrateLang('en');
    usePlannerStore.getState().applyHero(hero);
    return hero;
  }

  it('selectPointsTabStatus warn-dots only while the open hero is enabled', () => {
    hydrateFiringCora(true);
    expect(selectAdvisorPipeline(usePlannerStore.getState()).resetAdvice.recommend).toBe(true);
    expect(selectPointsTabStatus(usePlannerStore.getState()).badge).toBe('warn');
    expect(selectPointsTabStatus(usePlannerStore.getState()).issues).toContain(
      STRINGS.en.tabPointsResetAdvice,
    );

    usePlannerStore.getState().setHeroBattleAllowedOnHero('seed-cora', false);
    expect(selectPointsTabStatus(usePlannerStore.getState()).issues).not.toContain(
      STRINGS.en.tabPointsResetAdvice,
    );
  });
});

describe('disabled-hero copy + Points chrome contracts', () => {
  it('toggle labels use enabled / disabled copy in both langs', () => {
    expect(STRINGS.en.heroBattleActive).toBe('Enabled');
    expect(STRINGS.en.heroBattleInactive).toBe('Disabled');
    expect(STRINGS.pt.heroBattleActive).toBe('Ativado');
    expect(STRINGS.pt.heroBattleInactive).toBe('Desativado');
  });

  it('toggle titles do not mention respec inclusion', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].heroBattleActiveTitle).not.toMatch(/respec|reset|recomenda/i);
      expect(STRINGS[lang].heroBattleInactiveTitle).not.toMatch(/respec|reset|recomenda/i);
    }
  });

  it('Optimize build note explains automatic exclusion for a disabled hero', () => {
    expect(STRINGS.en.optimizeBuildHeroDisabledNote).toMatch(/disabled/i);
    expect(STRINGS.en.optimizeBuildHeroDisabledNote).toMatch(/automatic respec/i);
    expect(STRINGS.pt.optimizeBuildHeroDisabledNote).toMatch(/desativado/i);
    expect(STRINGS.pt.optimizeBuildHeroDisabledNote).toMatch(/recomendações automáticas/i);
  });

  it('Points preview notices animate via Collapsible and stay left-aligned', () => {
    const actions = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/planner/components/points-preview-actions.tsx'),
      'utf8',
    );
    const notice = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/planner/components/points-preview-notice.tsx'),
      'utf8',
    );
    expect(actions).toContain('optimizeBuildHeroDisabledNote');
    expect(actions).toContain('PointsPreviewNotice');
    expect(actions).toContain('optimizeBuildBudgetExhausted');
    expect(actions).toContain('previewRespecNote');
    expect(actions).not.toMatch(/['"]invisible['"]/);
    expect(actions).not.toMatch(/text-right/);
    expect(notice).toContain('Collapsible');
    expect(notice).toContain('text-left');
    expect(notice).not.toMatch(/text-right/);
  });

  it('a new Optimize run clears the applied-respec note', () => {
    const source = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/planner/components/points-table.tsx'),
      'utf8',
    );
    expect(source).toMatch(/function handleOptimize\([\s\S]*?setJustApplied\(false\)/);
  });

  it('strip and picker both render HeroActiveToggle', () => {
    const strip = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/planner/components/hero-strip-identity.tsx'),
      'utf8',
    );
    const picker = readFileSync(
      join(
        WEB_PACKAGE_ROOT,
        '../../packages/hero/src/components/hero-picker/hero-picker-row.tsx',
      ),
      'utf8',
    );
    expect(strip).toContain('HeroActiveToggle');
    expect(picker).toContain('HeroActiveToggle');
  });
});
