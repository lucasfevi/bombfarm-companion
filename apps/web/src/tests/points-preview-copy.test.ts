import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasApplicableGain, optimizeResultDisplay } from '@/features/planner/model/points-preview-copy';
import { STRINGS, type Lang } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

const LANGS: Lang[] = ['en', 'pt'];

describe('optimizeResultDisplay (AC-13)', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: gainPct === 0 returns the kept-current text`, () => {
      const display = optimizeResultDisplay(t, { gainPct: 0 }, formatNumber);
      expect(display.kind).toBe('kept');
      expect(display.kind === 'kept' && display.text).toBe(t.optimizeBuildKeptCurrent);
    });

    it(`${lang}: branches on gainPct, NOT on ReoptResult.keptCurrent — a keptCurrent-labelled
        seed lineage can still carry a real gain after its own local search (verified against
        optimizeBuild directly: pts.cdr = level returns keptCurrent: true with a 251% gainPct)`, () => {
      // Only gainPct is passed in — the function signature itself proves keptCurrent is not
      // consulted; this test pins the behavioural contract in prose too.
      const display = optimizeResultDisplay(t, { gainPct: 251.24 }, formatNumber);
      expect(display.kind).toBe('delta');
      if (display.kind !== 'delta') return;
      expect(display.tone).toBe('up');
      const html = renderToStaticMarkup(display.node);
      expect(html).toContain('251.2');
    });

    it(`${lang}: a real gain renders the best-allocation-found line with the percentage substituted`, () => {
      const display = optimizeResultDisplay(t, { gainPct: 7.25 }, formatNumber);
      expect(display.kind).toBe('delta');
      if (display.kind !== 'delta') return;
      expect(display.tone).toBe('up');
      const html = renderToStaticMarkup(display.node);
      expect(html).toContain('7.3');
      expect(html).not.toContain('{pct}');
    });

    it(`${lang}: a gain at the floating-point floor still reads as kept-current`, () => {
      const display = optimizeResultDisplay(t, { gainPct: 4.44e-14 }, formatNumber);
      expect(display.kind).toBe('kept');
      expect(display.kind === 'kept' && display.text).toBe(t.optimizeBuildKeptCurrent);
    });
  }
});

describe('hasApplicableGain (spec edge case: Apply is a no-op at zero gain)', () => {
  it('false at exactly 0', () => {
    expect(hasApplicableGain({ gainPct: 0 })).toBe(false);
  });

  it('false at floating-point noise near 0', () => {
    expect(hasApplicableGain({ gainPct: 4.44e-14 })).toBe(false);
  });

  it('true for any measurable gain', () => {
    expect(hasApplicableGain({ gainPct: 0.5 })).toBe(true);
    expect(hasApplicableGain({ gainPct: 251.24 })).toBe(true);
  });
});
