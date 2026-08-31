import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  farmOptimizeNotice,
  farmOptimizeResultDisplay,
  hasApplicableGain,
  optimizeResultDisplay,
  previewResultDisplay,
  type PointsPreview,
} from '@/features/planner/model/points-preview-copy';
import type { HeroFarmOptimizeOutcome, HeroFarmOptimizeResult } from '@bombfarm/domain/farm-hero-optimize';
import type { ReoptResult } from '@bombfarm/domain/points-reopt';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { STRINGS, type Lang } from '@/shared/i18n';
import { numberFormatterFor } from '@/shared/lib/format-number';

const LANGS: Lang[] = ['en', 'pt'];

function dpsPreview(gainPct: number): PointsPreview {
  return { mode: 'dps', pts: ZERO_PTS(), result: { gainPct } as ReoptResult };
}

function farmPreview(outcome: HeroFarmOptimizeOutcome, gainPct: number): PointsPreview {
  return { mode: 'farm', pts: ZERO_PTS(), result: { outcome, gainPct } as HeroFarmOptimizeResult };
}

describe('optimizeResultDisplay', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: gainPct === 0 returns the kept-current text`, () => {
      const display = optimizeResultDisplay(t, { gainPct: 0 }, numberFormatterFor(lang));
      expect(display.kind).toBe('kept');
      expect(display.kind === 'kept' && display.text).toBe(t.optimizeBuildKeptCurrent);
    });

    it(`${lang}: branches on gainPct, NOT on ReoptResult.keptCurrent — a keptCurrent-labelled
        seed lineage can still carry a real gain after its own local search (verified against
        optimizeBuild directly: pts.cdr = level returns keptCurrent: true with a 251% gainPct)`, () => {
      // Only gainPct is passed in — the function signature itself proves keptCurrent is not
      // consulted; this test pins the behavioural contract in prose too.
      const display = optimizeResultDisplay(t, { gainPct: 251.24 }, numberFormatterFor(lang));
      expect(display.kind).toBe('delta');
      if (display.kind !== 'delta') return;
      expect(display.tone).toBe('up');
      const html = renderToStaticMarkup(display.node);
      // The separator follows the language being rendered — asserting the English form in both
      // is what let a Portuguese reader be shown `251.2` for two hundred and fifty one.
      expect(html).toContain(lang === 'pt' ? '251,2' : '251.2');
    });

    it(`${lang}: a real gain renders the best-allocation-found line with the percentage substituted`, () => {
      const display = optimizeResultDisplay(t, { gainPct: 7.25 }, numberFormatterFor(lang));
      expect(display.kind).toBe('delta');
      if (display.kind !== 'delta') return;
      expect(display.tone).toBe('up');
      const html = renderToStaticMarkup(display.node);
      expect(html).toContain(lang === 'pt' ? '7,3' : '7.3');
      expect(html).not.toContain('{pct}');
    });

    it(`${lang}: a gain at the floating-point floor still reads as kept-current`, () => {
      const display = optimizeResultDisplay(t, { gainPct: 4.44e-14 }, numberFormatterFor(lang));
      expect(display.kind).toBe('kept');
      expect(display.kind === 'kept' && display.text).toBe(t.optimizeBuildKeptCurrent);
    });
  }
});

describe('hasApplicableGain (spec edge case: Apply is a no-op at zero gain)', () => {
  it('false at exactly 0', () => {
    expect(hasApplicableGain(dpsPreview(0))).toBe(false);
  });

  it('false at floating-point noise near 0', () => {
    expect(hasApplicableGain(dpsPreview(4.44e-14))).toBe(false);
  });

  it('true for any measurable gain', () => {
    expect(hasApplicableGain(dpsPreview(0.5))).toBe(true);
    expect(hasApplicableGain(dpsPreview(251.24))).toBe(true);
  });

  it('a farm preview that did not improve is never applicable, whatever its percentage reads', () => {
    expect(hasApplicableGain(farmPreview('nothingToGain', 0))).toBe(false);
    expect(hasApplicableGain(farmPreview('noFeasiblePhase', 12))).toBe(false);
    expect(hasApplicableGain(farmPreview('emptyPool', 12))).toBe(false);
  });

  it('a farm preview that improved by a measurable amount is applicable', () => {
    expect(hasApplicableGain(farmPreview('improved', 3.4))).toBe(true);
    expect(hasApplicableGain(farmPreview('improved', 4.44e-14))).toBe(false);
  });
});

describe('the two targets never borrow each other unit', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: a farm result renders the gold-per-hour line, never the sustained-DPS one`, () => {
      const display = farmOptimizeResultDisplay(t, { outcome: 'improved', gainPct: 7.25 }, numberFormatterFor(lang));
      expect(display?.kind).toBe('delta');
      if (display?.kind !== 'delta') return;
      const html = renderToStaticMarkup(display.node);
      expect(html).toContain(lang === 'pt' ? 'ouro por hora' : 'gold per hour');
      expect(html).not.toContain(lang === 'pt' ? 'DPS efetivo' : 'sustained DPS');
    });

    it(`${lang}: previewResultDisplay dispatches on the preview's own mode`, () => {
      const dps = previewResultDisplay(t, dpsPreview(7.25), numberFormatterFor(lang));
      const farm = previewResultDisplay(t, farmPreview('improved', 7.25), numberFormatterFor(lang));
      expect(dps?.kind).toBe('delta');
      expect(farm?.kind).toBe('delta');
      if (dps?.kind !== 'delta' || farm?.kind !== 'delta') return;
      expect(renderToStaticMarkup(dps.node)).not.toBe(renderToStaticMarkup(farm.node));
    });

    it(`${lang}: an outcome with nothing to compare says why instead of printing a 0% gain`, () => {
      for (const outcome of ['emptyPool', 'heroNotInPool', 'degenerate', 'noFeasiblePhase'] as const) {
        expect(farmOptimizeResultDisplay(t, { outcome, gainPct: 0 }, numberFormatterFor(lang))).toBeNull();
        expect(farmOptimizeNotice(t, outcome)).toBeTruthy();
      }
    });

    it(`${lang}: an outcome the search actually compared carries no notice`, () => {
      expect(farmOptimizeNotice(t, 'improved')).toBeNull();
      expect(farmOptimizeNotice(t, 'nothingToGain')).toBeNull();
    });
  }
});
