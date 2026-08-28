import { describe, expect, it } from 'vitest';
import type { ParseRejection } from '@bombfarm/domain/import-save';
import type { PointInferenceIssue } from '@bombfarm/domain/point-inference';
import {
  pointIssueCopyKey,
  pointIssueCopyText,
  rejectionText,
  type PointIssueCopyKey,
} from '@/features/import/model/compare-candidates';
import { STRINGS, type Lang } from '@/shared/i18n';

function issue(saturatedStats: ('critChance' | 'cdr')[]): PointInferenceIssue[] {
  return [{ kind: 'budgetMismatch', recovered: 10, budget: 12, difference: 2, saturatedStats }];
}

describe('pointIssueCopyKey', () => {
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

describe('pointIssueCopyText', () => {
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

describe('rejectionText', () => {
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

    it(`${lang}: unsupportedSaveShape renders the generic message, distinct from notASaveFile`, () => {
      const rejected: ParseRejection = { reason: 'unsupportedSaveShape', heroNames: [] };
      expect(rejectionText(t, rejected)).toBe(t.importRejectedUnsupportedShape);
      expect(rejectionText(t, rejected)).not.toBe(t.importRejectedNotASaveFile);
    });
  }
});
