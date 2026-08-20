import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHEET_PANEL_KEYS, ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type {
  FarmRespecFrontierEntry,
  FarmRespecHeroEntry,
  FarmRespecOutcome,
  FarmRespecResult,
} from '@bombfarm/domain/farm-optimize';
import {
  buildHeroCardRows,
  partitionHeroEntries,
  resolveFrontierEntries,
  resolveFrontierHeroNames,
  resolvePanelState,
  resolvePaybackKind,
  resolvePhaseChange,
} from '@/features/phases/model/farm-respec-view';
import type { FarmRespecProposal } from '@/shared/stores/slices/phases-slice';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

function heroEntry(overrides: Partial<FarmRespecHeroEntry> = {}): FarmRespecHeroEntry {
  return {
    heroId: 'h1',
    heroName: 'Hero One',
    level: 40,
    currentPts: { ...ZERO_PTS(), attack: 2, luck: 9 },
    proposedPts: { ...ZERO_PTS(), attack: 2, luck: 9 },
    changed: false,
    pointsMoved: 0,
    respecCostGold: 40000,
    degenerate: false,
    searchable: true,
    ...overrides,
  };
}

describe('farm-respec-view', () => {
  it('is React-free — no import from "react" anywhere in the file', () => {
    const source = readFileSync(
      `${WEB_PACKAGE_ROOT}/src/features/phases/model/farm-respec-view.ts`,
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]react['"]/);
  });

  describe('buildHeroCardRows', () => {
    it('returns eight rows in SHEET_PANEL_KEYS order', () => {
      const rows = buildHeroCardRows(heroEntry());
      expect(rows).toHaveLength(8);
      expect(rows.map((row) => row.key)).toEqual([...SHEET_PANEL_KEYS]);
    });

    it('each row has exactly the four documented fields — no optional/negligible/minor/skip field exists', () => {
      const rows = buildHeroCardRows(heroEntry());
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(['current', 'keep', 'key', 'target']);
      }
    });

    it('target is the ABSOLUTE proposed value, not a diff, for a changed key', () => {
      const entry = heroEntry({
        currentPts: { ...ZERO_PTS(), attack: 2, luck: 9 },
        proposedPts: { ...ZERO_PTS(), attack: 7, luck: 9 },
        changed: true,
      });
      const attackRow = buildHeroCardRows(entry).find((row) => row.key === 'attack')!;
      expect(attackRow.target).toBe(7);
      expect(attackRow.current).toBe(2);
    });

    it('the luck row keeps keep:true even when luck is the majority of the hero\'s level', () => {
      const entry = heroEntry({
        level: 40,
        currentPts: { ...ZERO_PTS(), luck: 35 },
        proposedPts: { ...ZERO_PTS(), luck: 35 },
      });
      const luckRow = buildHeroCardRows(entry).find((row) => row.key === 'luck')!;
      expect(luckRow.keep).toBe(true);
      expect(luckRow.current).toBe(35);
      expect(luckRow.target).toBe(35);
    });

    it('non-luck rows are not tagged keep', () => {
      const rows = buildHeroCardRows(heroEntry());
      for (const row of rows) {
        if (row.key !== 'luck') expect(row.keep).toBe(false);
      }
    });
  });

  describe('partitionHeroEntries', () => {
    function withHeroes(heroes: FarmRespecHeroEntry[]): FarmRespecResult {
      return { heroes } as unknown as FarmRespecResult;
    }

    const mixed = [
      heroEntry({ heroId: 'a', changed: true }),
      heroEntry({ heroId: 'b', changed: false }),
      heroEntry({ heroId: 'c', changed: true }),
      heroEntry({ heroId: 'd', changed: false }),
    ];

    // The invariant the hero grid's old source-scanning guard stood in for: a partition, so no
    // hero can be dropped on the way to a card.
    it('every entry lands in exactly one group — the two lengths sum to the input\'s', () => {
      const groups = partitionHeroEntries(withHeroes(mixed));
      expect(groups.changed.length + groups.unchanged.length).toBe(mixed.length);
      expect([...groups.changed, ...groups.unchanged].map((entry) => entry.heroId).sort()).toEqual([
        'a',
        'b',
        'c',
        'd',
      ]);
    });

    it('preserves input order within each group', () => {
      const groups = partitionHeroEntries(withHeroes(mixed));
      expect(groups.changed.map((entry) => entry.heroId)).toEqual(['a', 'c']);
      expect(groups.unchanged.map((entry) => entry.heroId)).toEqual(['b', 'd']);
    });

    it('an all-changed roster yields an empty unchanged group, and vice versa', () => {
      const allChanged = partitionHeroEntries(withHeroes([heroEntry({ changed: true })]));
      expect(allChanged.unchanged).toEqual([]);
      const allUnchanged = partitionHeroEntries(withHeroes([heroEntry({ changed: false })]));
      expect(allUnchanged.changed).toEqual([]);
    });

    it('an empty roster yields two empty groups, not a throw', () => {
      const groups = partitionHeroEntries(withHeroes([]));
      expect(groups).toEqual({ changed: [], unchanged: [] });
    });
  });

  describe('resolvePaybackKind', () => {
    function result(overrides: Partial<FarmRespecResult>): FarmRespecResult {
      return {
        paybackHours: null,
        proposedGoldPerHour: 100,
        currentGoldPerHour: 100,
        ...overrides,
      } as FarmRespecResult;
    }

    it('a finite paybackHours resolves to "hours"', () => {
      expect(resolvePaybackKind(result({ paybackHours: 2.5 }))).toBe('hours');
    });

    it('a null payback always resolves to "no-change" — there is no third kind', () => {
      expect(
        resolvePaybackKind(result({ paybackHours: null, proposedGoldPerHour: 80, currentGoldPerHour: 100 })),
      ).toBe('no-change');
    });

    it('null payback with UNCHANGED gold resolves to "no-change"', () => {
      expect(
        resolvePaybackKind(result({ paybackHours: null, proposedGoldPerHour: 100, currentGoldPerHour: 100 })),
      ).toBe('no-change');
    });
  });

  describe('resolvePanelState', () => {
    function proposal(outcome: FarmRespecOutcome, budgetExhausted = false): FarmRespecProposal {
      return {
        deps: [],
        result: { outcome, budgetExhausted } as FarmRespecResult,
      };
    }

    it('status "solving" resolves to {kind: "solving"} regardless of the view', () => {
      expect(resolvePanelState(null, 'solving')).toEqual({ kind: 'solving' });
    });

    it('status "failed" resolves to {kind: "failed"} regardless of the view', () => {
      expect(resolvePanelState(null, 'failed')).toEqual({ kind: 'failed' });
    });

    it('a normal outcome resolves to {kind: "result"}, carrying budgetExhausted through', () => {
      const view = proposal('improved', true);
      expect(resolvePanelState(view, 'done')).toEqual({
        kind: 'result',
        result: view.result,
        budgetExhausted: true,
      });
    });

    it.each<FarmRespecOutcome>(['emptyPool', 'allDegenerate', 'noBudget', 'noFeasiblePhase'])(
      'the terminal outcome %s resolves to {kind: "terminal", outcome}',
      (outcome) => {
        const view = proposal(outcome);
        expect(resolvePanelState(view, 'done')).toEqual({ kind: 'terminal', outcome });
      },
    );

    it('"nothingToGain" is NOT terminal — it resolves as a normal result', () => {
      const view = proposal('nothingToGain');
      expect(resolvePanelState(view, 'done').kind).toBe('result');
    });
  });

  describe('resolvePhaseChange', () => {
    function result(currentPhase: number | null, recommendedPhase: number | null): FarmRespecResult {
      return { currentPhase, recommendedPhase } as FarmRespecResult;
    }

    it('both phases null resolves to {kind: "both-null"}', () => {
      expect(resolvePhaseChange(result(null, null))).toEqual({ kind: 'both-null' });
    });

    it('the same non-null phase on both sides resolves to {kind: "same", phase}', () => {
      expect(resolvePhaseChange(result(51, 51))).toEqual({ kind: 'same', phase: 51 });
    });

    it('a genuine move (both sides non-null, different) resolves to {kind: "moved", ...}', () => {
      expect(resolvePhaseChange(result(27, 51))).toEqual({
        kind: 'moved',
        currentPhase: 27,
        recommendedPhase: 51,
      });
    });

    it('current null, recommended non-null resolves to {kind: "moved", ...} — not "same"', () => {
      expect(resolvePhaseChange(result(null, 51))).toEqual({
        kind: 'moved',
        currentPhase: null,
        recommendedPhase: 51,
      });
    });

    it('current non-null, recommended null resolves to {kind: "moved", ...} — not "same"', () => {
      expect(resolvePhaseChange(result(27, null))).toEqual({
        kind: 'moved',
        currentPhase: 27,
        recommendedPhase: null,
      });
    });
  });

  describe('resolveFrontierHeroNames', () => {
    function frontierEntry(
      heroIds: string[],
      heroes: FarmRespecHeroEntry[],
    ): FarmRespecFrontierEntry {
      return {
        heroCount: heroIds.length,
        heroIds,
        heroes,
        recommendedPhase: 28,
        proposedObjective: 1,
        gainPct: 5,
        respecCostGold: 72000,
        paybackHours: 0.1,
        proposedGoldPerHour: 10,
        proposedChestsPerHour: 1,
      };
    }

    // Red against the shipped implementation, which rendered `entry.heroes` — the FULL enabled
    // pool — under a "1 hero" label.
    it('names only the tier\'s own heroes, never every enabled hero', () => {
      const entry = frontierEntry(
        ['h2'],
        [
          heroEntry({ heroId: 'h1', heroName: 'Minato' }),
          heroEntry({ heroId: 'h2', heroName: 'Bellatrix' }),
          heroEntry({ heroId: 'h3', heroName: 'Yara' }),
        ],
      );
      expect(resolveFrontierHeroNames(entry)).toEqual(['Bellatrix']);
    });

    it('the name count always equals heroCount', () => {
      const heroes = [
        heroEntry({ heroId: 'h1', heroName: 'Minato' }),
        heroEntry({ heroId: 'h2', heroName: 'Bellatrix' }),
        heroEntry({ heroId: 'h3', heroName: 'Yara' }),
      ];
      for (const heroIds of [['h1'], ['h1', 'h3']]) {
        const entry = frontierEntry(heroIds, heroes);
        expect(resolveFrontierHeroNames(entry)).toHaveLength(entry.heroCount);
      }
    });

    it('follows heroIds order, not the order heroes happens to be in', () => {
      const entry = frontierEntry(
        ['h3', 'h1'],
        [heroEntry({ heroId: 'h1', heroName: 'Minato' }), heroEntry({ heroId: 'h3', heroName: 'Yara' })],
      );
      expect(resolveFrontierHeroNames(entry)).toEqual(['Yara', 'Minato']);
    });

    it('an unmatched id falls back to the id — never a list shorter than heroCount', () => {
      const entry = frontierEntry(['h1', 'ghost'], [heroEntry({ heroId: 'h1', heroName: 'Minato' })]);
      expect(resolveFrontierHeroNames(entry)).toEqual(['Minato', 'ghost']);
    });
  });

  describe('resolveFrontierEntries', () => {
    it('a non-empty frontier is passed through by IDENTITY — never copied, sorted or reversed', () => {
      const frontier: FarmRespecFrontierEntry[] = [
        { heroCount: 1, heroIds: ['a'], heroes: [], recommendedPhase: 10, proposedObjective: 1, gainPct: 5, respecCostGold: 1000, paybackHours: 1, proposedGoldPerHour: 10, proposedChestsPerHour: 1 },
      ];
      const result = { frontier } as unknown as FarmRespecResult;
      expect(resolveFrontierEntries(result)).toBe(frontier);
    });

    it('an empty frontier yields null — a render-nothing signal, not an empty list', () => {
      const result = { frontier: [] } as unknown as FarmRespecResult;
      expect(resolveFrontierEntries(result)).toBeNull();
    });
  });
});
