/**
 * The next-point panel and hero strip. This repo has no DOM-rendering test idiom (no jsdom /
 * @testing-library/react dependency — see farm-ranking-board.test.ts's own note on the same
 * point), so the panel's rendering rules are proved two ways: direct unit tests of the pure
 * functions the component exports, and source-scanning for the option list and wiring that
 * can't be expressed as a pure function.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatSignedGainPct,
  barPercent,
  fallbackNoteText,
} from '@/features/planner/components/next-point-ranking';
import { STRINGS } from '@/shared/i18n';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

function read(relativePath: string): string {
  return readFileSync(`${WEB_PACKAGE_ROOT}/${relativePath}`, 'utf8');
}

describe('formatSignedGainPct', () => {
  it('a non-negative value renders byte-identical to the pre-farm-mode "+{n}%" string', () => {
    expect(formatSignedGainPct(2.5, 'en')).toBe('+2.5%');
    expect(formatSignedGainPct(0, 'en')).toBe('+0.0%');
  });

  it('a negative farm gain renders with a minus sign and the absolute magnitude', () => {
    expect(formatSignedGainPct(-3.14159, 'en')).toBe('−3.1%');
  });
});

describe('barPercent', () => {
  it('a positive gain scales against the best row, floored at 2', () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(0.001, 10)).toBe(2); // floored, never invisible
  });

  it('a negative farm gain contributes 0 to the numerator rather than a negative width, still floored at 2', () => {
    expect(barPercent(-5, 10)).toBe(2);
  });

  it('best.gainPct at or below 0 never divides by zero (0.01 floor)', () => {
    expect(Number.isFinite(barPercent(1, 0))).toBe(true);
  });
});

describe('fallbackNoteText', () => {
  const t = STRINGS.en;

  it.each(['emptyPool', 'heroNotInPool'] as const)('%s renders the no-pool note', (outcome) => {
    expect(fallbackNoteText(outcome, t)).toBe(t.rankFarmNoPool);
  });

  it.each(['allDegenerate', 'noBaseline'] as const)('%s renders the no-rate note', (outcome) => {
    expect(fallbackNoteText(outcome, t)).toBe(t.rankFarmNoRate);
  });

  it('the two notes are actually different strings (the mapping is not accidentally a no-op)', () => {
    expect(t.rankFarmNoPool).not.toBe(t.rankFarmNoRate);
  });
});

describe('next-point-ranking.tsx — the mode select', () => {
  const source = read('src/features/planner/components/next-point-ranking.tsx');

  it('offers exactly dps and farm — the retired oneshot option is gone', () => {
    expect(source).toContain('<option value="dps">');
    expect(source).toContain('<option value="farm">');
    expect(source).not.toContain('oneshot');
  });

  it('dps keeps its position (declared before farm, unchanged from before this item)', () => {
    expect(source.indexOf('<option value="dps">')).toBeLessThan(source.indexOf('<option value="farm">'));
  });

  it('the select is still bound to state.rankMode with the same value/onChange contract', () => {
    expect(source).toContain('value={rankMode}');
    expect(source).toContain("event.target.value as RankMode");
  });

  it('rows come from selectNextPointRanking, not the raw advisor pipeline', () => {
    expect(source).toContain('selectNextPointRanking');
    expect(source).not.toContain('selectAdvisorPipeline');
  });

  it('exactly one context line can render at once — fallback wins over addedToPool (mutually exclusive ternary branches, never both)', () => {
    // The fallback != null branch and the addedToPool branch are chained as
    // `condA ? X : condB ? Y : null` — a single expression tree that can only ever select one
    // branch, structurally ruling out "both render".
    expect(source).toMatch(/fallback\s*!=\s*null\s*\?[\s\S]*?:\s*addedToPool\s*\?[\s\S]*?:\s*null/);
  });
});

describe('hero-strip-metrics.tsx — mode-aware best, same signed format', () => {
  const source = read('src/features/planner/components/hero-strip-metrics.tsx');

  it('reads the mode-aware selectBestStat / selectBestGainPct, not pipeline.best directly', () => {
    expect(source).toContain('selectBestStat');
    expect(source).toContain('selectBestGainPct');
    expect(source).not.toContain('best.stat');
    expect(source).not.toContain('best.gainPct');
  });

  it('applies the same signed formatting rule as the panel', () => {
    expect(source).toContain('formatSignedGainPct');
  });
});
