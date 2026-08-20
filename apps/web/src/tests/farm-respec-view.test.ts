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
  resolveFrontierEntries,
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

    it('each row has exactly the five documented fields — no optional/negligible/minor/skip field exists', () => {
      const rows = buildHeroCardRows(heroEntry());
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(['current', 'delta', 'keep', 'key', 'target']);
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
      expect(attackRow.delta).toBe(5);
    });

    it('the luck row keeps keep:true and delta:0 even when luck is the majority of the hero\'s level', () => {
      const entry = heroEntry({
        level: 40,
        currentPts: { ...ZERO_PTS(), luck: 35 },
        proposedPts: { ...ZERO_PTS(), luck: 35 },
      });
      const luckRow = buildHeroCardRows(entry).find((row) => row.key === 'luck')!;
      expect(luckRow.keep).toBe(true);
      expect(luckRow.delta).toBe(0);
      expect(luckRow.target).toBe(35);
    });

    it('non-luck rows are not tagged keep', () => {
      const rows = buildHeroCardRows(heroEntry());
      for (const row of rows) {
        if (row.key !== 'luck') expect(row.keep).toBe(false);
      }
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

    it('null payback with a gold LOSS resolves to "no-gold-gain"', () => {
      expect(
        resolvePaybackKind(result({ paybackHours: null, proposedGoldPerHour: 80, currentGoldPerHour: 100 })),
      ).toBe('no-gold-gain');
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
