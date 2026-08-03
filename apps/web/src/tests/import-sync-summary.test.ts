import { describe, expect, it } from 'vitest';
import type { ImportCandidate, ParseRejection } from '@bombfarm/domain/import-save';
import type { PointInferenceIssue } from '@bombfarm/domain/point-inference';
import type { HeroRecord } from '@/shared/lib/storage';
import {
  pointIssueCopyKey,
  pointIssueCopyText,
  rejectionText,
  summarizeImportSync,
  type PointIssueCopyKey,
} from '@/features/import/model/compare-candidates';
import { STRINGS, type Lang } from '@/shared/i18n';

function cand(
  partial: Partial<ImportCandidate> & Pick<ImportCandidate, 'name' | 'sourceId'>,
): ImportCandidate {
  return {
    level: 1,
    rarity: 'Comum',
    rank: 'E',
    power: 100,
    abilityCount: 0,
    gearCount: 0,
    issues: [],
    pointIssues: [],
    blocked: false,
    matchedExistingId: null,
    matchedExistingName: null,
    isGearRefresh: false,
    record: { name: partial.name, sourceId: partial.sourceId } as ImportCandidate['record'],
    ...partial,
  };
}

function hero(partial: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>): HeroRecord {
  return {
    updatedAt: 0,
    rarity: 'Comum',
    level: 1,
    stars: 0,
    naked: {} as HeroRecord['naked'],
    loadout: {},
    altLoadout: null,
    gearedOverride: {} as HeroRecord['gearedOverride'],
    abilities: {},
    pts: {} as HeroRecord['pts'],
    ...partial,
  };
}

describe('summarizeImportSync (AC-32, W5 AC-28, DEC-08)', () => {
  it('empty roster, empty save: everything is 0', () => {
    expect(summarizeImportSync([], [])).toEqual({ created: 0, updated: 0, removed: 0 });
  });

  it('a fresh candidate with no existing match counts as created', () => {
    const candidates = [cand({ sourceId: 's1', name: 'Vera' })];
    expect(summarizeImportSync(candidates, [])).toEqual({ created: 1, updated: 0, removed: 0 });
  });

  it('a candidate matching an existing hero counts as updated, not created', () => {
    const candidates = [cand({ sourceId: 's1', name: 'Vera', matchedExistingId: 'h1' })];
    const existing = [hero({ id: 'h1', name: 'Vera', sourceId: 's1' })];
    expect(summarizeImportSync(candidates, existing)).toEqual({ created: 0, updated: 1, removed: 0 });
  });

  it('an existing hero absent from the save counts as removed', () => {
    const candidates = [cand({ sourceId: 's1', name: 'Vera', matchedExistingId: 'h1' })];
    const existing = [
      hero({ id: 'h1', name: 'Vera', sourceId: 's1' }),
      hero({ id: 'h2', name: 'Gale', sourceId: 's2' }),
    ];
    expect(summarizeImportSync(candidates, existing)).toEqual({ created: 0, updated: 1, removed: 1 });
  });

  it('a hero with no sourceId (never imported) is never counted as removed', () => {
    const candidates: ImportCandidate[] = [];
    const existing = [hero({ id: 'h1', name: 'Local only' })];
    expect(summarizeImportSync(candidates, existing)).toEqual({ created: 0, updated: 0, removed: 0 });
  });

  it('a blocked candidate is neither created, updated, nor counted as removed (W5 AC-28)', () => {
    const candidates = [cand({ sourceId: 's1', name: 'Broken', blocked: true })];
    const existing = [hero({ id: 'h1', name: 'Broken', sourceId: 's1' })];
    // The blocked candidate's sourceId stays in the keep set — the existing hero with that
    // sourceId is preserved, not removed, and the candidate itself is not created/updated.
    expect(summarizeImportSync(candidates, existing)).toEqual({ created: 0, updated: 0, removed: 0 });
  });

  it('mixed: created + updated + removed + a neutral blocked candidate, all at once', () => {
    const candidates = [
      cand({ sourceId: 'new', name: 'New' }),
      cand({ sourceId: 'existing', name: 'Existing', matchedExistingId: 'h1' }),
      cand({ sourceId: 'broken', name: 'Broken', blocked: true }),
    ];
    const existing = [
      hero({ id: 'h1', name: 'Existing', sourceId: 'existing' }),
      hero({ id: 'h2', name: 'Broken', sourceId: 'broken' }),
      hero({ id: 'h3', name: 'Gone', sourceId: 'gone' }),
    ];
    expect(summarizeImportSync(candidates, existing)).toEqual({ created: 1, updated: 1, removed: 1 });
  });
});

function issue(saturatedStats: ('critChance' | 'cdr')[]): PointInferenceIssue[] {
  return [{ kind: 'budgetMismatch', recovered: 10, budget: 12, difference: 2, saturatedStats }];
}

describe('pointIssueCopyKey (BSP-04b, AC-35)', () => {
  it('returns null when there is no budgetMismatch issue', () => {
    expect(pointIssueCopyKey([])).toBeNull();
    expect(pointIssueCopyKey([{ kind: 'negativePoints', key: 'attack', raw: -1 }])).toBeNull();
  });

  it('neither stat saturated: the plain shortfall branch', () => {
    const result: PointIssueCopyKey = pointIssueCopyKey(issue([]));
    expect(result).toBe('shortfall');
  });

  it('exactly one stat saturated: names it as the likely destination', () => {
    const result: PointIssueCopyKey = pointIssueCopyKey(issue(['critChance']));
    expect(result).toEqual({ key: 'oneSaturated', stat: 'critChance' });
  });

  it('exactly one stat saturated (cdr): names it too', () => {
    const result: PointIssueCopyKey = pointIssueCopyKey(issue(['cdr']));
    expect(result).toEqual({ key: 'oneSaturated', stat: 'cdr' });
  });

  it('both stats saturated: the split cannot be recovered', () => {
    const result: PointIssueCopyKey = pointIssueCopyKey(issue(['critChance', 'cdr']));
    expect(result).toBe('bothSaturated');
  });
});

const LANGS: Lang[] = ['en', 'pt'];

describe('pointIssueCopyText (BSP-04b, AC-35)', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: null when there is no budgetMismatch issue`, () => {
      expect(pointIssueCopyText(t, [])).toBeNull();
    });

    it(`${lang}: the plain shortfall line when neither stat is saturated`, () => {
      expect(pointIssueCopyText(t, issue([]))).toBe(t.importPointShortfall);
    });

    it(`${lang}: names the saturated stat when exactly one is capped`, () => {
      const text = pointIssueCopyText(t, issue(['critChance']));
      expect(text).toContain(t.statFull.critChance);
      expect(text).not.toBe(t.importPointShortfall);
      expect(text).not.toBe(t.importPointBothSaturated);
    });

    it(`${lang}: the both-saturated line when both are capped`, () => {
      expect(pointIssueCopyText(t, issue(['critChance', 'cdr']))).toBe(t.importPointBothSaturated);
    });
  }
});

describe('rejectionText (BSP-06, DEC-09, AC-36)', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: notASaveFile`, () => {
      const rejected: ParseRejection = { reason: 'notASaveFile', heroNames: [] };
      expect(rejectionText(t, rejected)).toBe(t.importRejectedNotASaveFile);
    });

    it(`${lang}: missingBirthStats names the affected heroes`, () => {
      const rejected: ParseRejection = { reason: 'missingBirthStats', heroNames: ['Vera', 'Gale'] };
      const text = rejectionText(t, rejected);
      expect(text).toContain('Vera');
      expect(text).toContain('Gale');
      expect(text).not.toBe(t.importRejectedNotASaveFile);
    });
  }
});
