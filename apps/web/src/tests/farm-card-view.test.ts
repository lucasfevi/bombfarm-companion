import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  farmCardViewFrom,
  resetFarmCardViewCacheForTests,
  selectFarmCardRows,
  type FarmSentenceFragment,
} from '@/features/home/model/farm-card-view';
import { buildFarmSentence, formatSignedPct } from '@/features/home/model/farm-sentence';
import { STRINGS } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectFarmBoardRows,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

function row(overrides: Partial<FarmRateRow> & { phase: number }): FarmRateRow {
  return {
    ato: 1,
    gate: false,
    locked: false,
    mitigationPct: 0,
    goldPerHour: 0,
    chestsPerHour: 0,
    keysPerHour: 0,
    gemsPerHour: 0,
    timePiecesPerHour: 0,
    stoneChestsPerHour: 0,
    xpPerHour: 0,
    propsPerHour: 0,
    cyclesPerHour: 0,
    clearSecs: 60,
    gateTimerSecs: null,
    oneShot: false,
    infeasible: false,
    itemLevels: [10],
    itemLevelLabel: '10',
    jaulaEarlyCapPct: 0,
    jaulaWindowSecs: 0,
    expectedHtk: 1,
    heroesOnField: 1,
    fieldContentionPct: 0,
    concurrencyScale: 1,
    fortunaAura: 0,
    ...overrides,
  };
}

function farmHero(id: string) {
  const stats = { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 };
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: stats,
    gearedOverride: stats,
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: true,
  });
}

function hydrateBoard(): void {
  usePlannerStore.getState().hydrateRoster([farmHero('a'), farmHero('b')], null);
  usePlannerStore.getState().applyAccountImport({
    tree: null,
    houseIdx: 0,
    houseLevel: 5,
    phase: 51,
    maxPhase: 137,
  });
}

const state = () => usePlannerStore.getState();

/** Two unlocked rows tie at the top, one unlocked row is infeasible, one locked row beats them all. */
const board = [
  row({ phase: 10, goldPerHour: 100 }),
  row({ phase: 20, goldPerHour: 300, infeasible: true }),
  row({ phase: 30, goldPerHour: 250 }),
  row({ phase: 40, goldPerHour: 250 }),
  row({ phase: 50, goldPerHour: 400, locked: true }),
];

describe('the front page’s current-versus-best phase view', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmCardViewCacheForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetFarmCardViewCacheForTests();
  });

  it('the best phase is the highest gold per hour among unlocked, feasible rows, ties to the lower phase', () => {
    const view = farmCardViewFrom(board, 10);

    expect(view.currentRow?.phase).toBe(10);
    expect(view.bestRow?.phase).toBe(30);
  });

  it('a locked row that beats the best phase names the push target with its percentage; one that does not is silent', () => {
    const beaten = farmCardViewFrom(board, 10);
    expect(beaten.pushTargetRow?.phase).toBe(50);
    const pushPct =
      ((beaten.pushTargetRow!.goldPerHour - beaten.bestRow!.goldPerHour) / beaten.bestRow!.goldPerHour) * 100;
    expect(formatSignedPct(pushPct, 'en')).toBe('+60.0%');

    const notBeaten = farmCardViewFrom([...board.slice(0, 4), row({ phase: 50, goldPerHour: 250, locked: true })], 10);
    expect(notBeaten.pushTargetRow).toBeNull();

    expect(farmCardViewFrom(board.slice(0, 4), 10).pushTargetRow).toBeNull();
  });

  it('the same phase yields the neutral pill and no sentence', () => {
    const view = farmCardViewFrom(board, 30);

    expect(view.pill).toEqual({ tone: 'neutral', pct: null });
    expect(view.sentence).toEqual([]);
    expect(view.bestRow).toBe(view.currentRow);
    expect(view.barPercent).toEqual({ current: 100, best: 100 });
  });

  it('the pill is signed to one decimal with its tone', () => {
    const up = farmCardViewFrom([row({ phase: 1, goldPerHour: 100 }), row({ phase: 2, goldPerHour: 104.63 })], 1);
    expect(up.pill.tone).toBe('up');
    expect(formatSignedPct(up.pill.pct!, 'en')).toBe('+4.6%');
    expect(up.barPercent.best).toBe(100);
    expect(up.barPercent.current).toBeCloseTo((100 / 104.63) * 100, 10);

    const down = farmCardViewFrom(
      [row({ phase: 1, goldPerHour: 100, infeasible: true }), row({ phase: 2, goldPerHour: 95.37 })],
      1,
    );
    expect(down.pill.tone).toBe('down');
    expect(formatSignedPct(down.pill.pct!, 'pt')).toBe('−4,6%');
    expect(down.barPercent.current).toBe(100);

    expect(formatSignedPct(0, 'en')).toBe('0.0%');
  });

  it('every sentence fragment appears only when its condition holds, in the fixed order, in both locales', () => {
    type Tile = Partial<FarmRateRow> & { phase: number };
    const cases: { name: string; current: Tile; best: Tile; fragments: FarmSentenceFragment[] }[] = [
      { name: 'ahead', current: { phase: 10 }, best: { phase: 13 }, fragments: [{ kind: 'ahead', count: 3 }] },
      { name: 'behind', current: { phase: 13 }, best: { phase: 10 }, fragments: [{ kind: 'behind', count: 3 }] },
      {
        name: 'clear faster',
        current: { phase: 10, clearSecs: 90 },
        best: { phase: 11, clearSecs: 60 },
        fragments: [{ kind: 'ahead', count: 1 }, { kind: 'clearFaster', deltaSecs: 30 }],
      },
      {
        name: 'clear slower',
        current: { phase: 10, clearSecs: 60 },
        best: { phase: 11, clearSecs: 90 },
        fragments: [{ kind: 'ahead', count: 1 }, { kind: 'clearSlower', deltaSecs: 30 }],
      },
      {
        name: 'clear equal says nothing',
        current: { phase: 10, clearSecs: 60 },
        best: { phase: 11, clearSecs: 60 },
        fragments: [{ kind: 'ahead', count: 1 }],
      },
      {
        name: 'an unclearable current says nothing about clear time',
        current: { phase: 10, clearSecs: Infinity },
        best: { phase: 11, clearSecs: 60 },
        fragments: [{ kind: 'ahead', count: 1 }],
      },
      {
        name: 'item level up, from the lowest band',
        current: { phase: 10, itemLevels: [10, 12] },
        best: { phase: 11, itemLevels: [14, 11] },
        fragments: [{ kind: 'ahead', count: 1 }, { kind: 'itemLevelUp', delta: 1 }],
      },
      {
        name: 'item level down, from the lowest band',
        current: { phase: 10, itemLevels: [14, 11] },
        best: { phase: 11, itemLevels: [10, 12] },
        fragments: [{ kind: 'ahead', count: 1 }, { kind: 'itemLevelDown', delta: 1 }],
      },
      {
        name: 'one-shot gained',
        current: { phase: 10, oneShot: false },
        best: { phase: 11, oneShot: true },
        fragments: [{ kind: 'ahead', count: 1 }, { kind: 'oneShotGained' }],
      },
      {
        name: 'one-shot lost',
        current: { phase: 10, oneShot: true },
        best: { phase: 11, oneShot: false },
        fragments: [{ kind: 'ahead', count: 1 }, { kind: 'oneShotLost' }],
      },
      {
        name: 'one-shot on both says nothing',
        current: { phase: 10, oneShot: true },
        best: { phase: 11, oneShot: true },
        fragments: [{ kind: 'ahead', count: 1 }],
      },
      {
        name: 'all four, in the fixed order',
        current: { phase: 10, clearSecs: 90, itemLevels: [10], oneShot: false },
        best: { phase: 13, clearSecs: 60, itemLevels: [11], oneShot: true },
        fragments: [
          { kind: 'ahead', count: 3 },
          { kind: 'clearFaster', deltaSecs: 30 },
          { kind: 'itemLevelUp', delta: 1 },
          { kind: 'oneShotGained' },
        ],
      },
    ];

    for (const { name, current, best, fragments } of cases) {
      const rows = [row({ goldPerHour: 100, ...current }), row({ goldPerHour: 200, ...best })];
      expect(farmCardViewFrom(rows, current.phase).sentence, name).toEqual(fragments);
    }

    const all = cases[cases.length - 1].fragments;
    expect(buildFarmSentence(all, STRINGS.en, 'en')).toBe(
      '3 phases ahead, 30s faster to clear, +1 item level, you one-shot every prop there.',
    );
    expect(buildFarmSentence(all, STRINGS.pt, 'pt')).toBe(
      '3 fases à frente, 30s mais rápida de limpar, +1 de nível de item, você mata todo obstáculo de um golpe lá.',
    );
    expect(buildFarmSentence([{ kind: 'behind', count: 2 }, { kind: 'oneShotLost' }], STRINGS.en, 'en')).toBe(
      '2 phases behind, you stop one-shotting props.',
    );
    expect(buildFarmSentence([], STRINGS.en, 'en')).toBeNull();
  });

  it('the view takes no sort or filter argument', () => {
    expectTypeOf(selectFarmCardRows).parameters.toEqualTypeOf<[state: PlannerStore]>();
    expect(selectFarmCardRows.length).toBe(1);

    hydrateBoard();
    const { rows } = selectFarmBoardRows(state());
    expect(rows.length).toBe(600);
    expect(selectFarmCardRows(state())).toEqual(farmCardViewFrom(rows, 51));
  });

  it('a rotation-pool override or a Return Bonus change moves the tiles', () => {
    hydrateBoard();
    const both = selectFarmCardRows(state());
    expect(both.currentRow?.phase).toBe(51);

    state().setFarmHeroEnabled('b', false);
    const oneHero = selectFarmCardRows(state());
    expect(oneHero).not.toBe(both);
    expect(oneHero.currentRow!.goldPerHour).not.toBe(both.currentRow!.goldPerHour);

    state().setFarmReturnBonus('vip');
    const withBonus = selectFarmCardRows(state());
    expect(withBonus).not.toBe(oneHero);
    expect(withBonus.currentRow!.goldPerHour).toBeGreaterThan(oneHero.currentRow!.goldPerHour);
  });

  it('no current row, no unlocked feasible row, or an empty board leaves both tiles null', () => {
    const nothing = { currentRow: null, bestRow: null, pushTargetRow: null };

    expect(farmCardViewFrom(board, 999)).toMatchObject(nothing);
    expect(
      farmCardViewFrom(
        [row({ phase: 10, goldPerHour: 100, infeasible: true }), row({ phase: 50, goldPerHour: 400, locked: true })],
        10,
      ),
    ).toMatchObject(nothing);
    expect(farmCardViewFrom([], 10)).toMatchObject(nothing);

    expect(selectFarmBoardRows(state()).rows).toEqual([]);
    expect(selectFarmCardRows(state())).toMatchObject(nothing);
  });

  it('the view is the same object until the board rows or the phase change', () => {
    hydrateBoard();
    const first = selectFarmCardRows(state());
    expect(selectFarmCardRows(state())).toBe(first);

    state().setLang('en');
    expect(selectFarmCardRows(state())).toBe(first);

    state().setFarmPhase(60);
    const movedPhase = selectFarmCardRows(state());
    expect(movedPhase).not.toBe(first);
    expect(movedPhase.currentRow?.phase).toBe(60);

    state().hydrateRoster([farmHero('a')], null);
    expect(selectFarmCardRows(state())).not.toBe(movedPhase);
  });
});

describe('the front page’s phase view reads every figure off the board’s rows', () => {
  it('imports no farm-rate function from the domain', () => {
    const source = readFileSync(join(WEB_PACKAGE_ROOT, 'src/features/home/model/farm-card-view.ts'), 'utf8');
    const specifiers = Array.from(source.matchAll(/from '([^']+)'/g), (match) => match[1]);

    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((specifier) => specifier.includes('farm-rate'))).toEqual([]);
    expect(specifiers.filter((specifier) => specifier.startsWith('@bombfarm/domain'))).toEqual([]);
  });
});
