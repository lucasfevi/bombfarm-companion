import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatBand,
  formatMitigationPct,
  formatOneShot,
  formatPhaseLabel,
  formatRate,
  formatSignedRate,
} from '@/features/phases/model/farm-ranking-format';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

describe('formatRate', () => {
  it('formats zero', () => {
    expect(formatRate(0)).toBe('0');
  });

  it('formats a very large value compactly', () => {
    expect(formatRate(1_250_000)).toBe('1.3m');
  });

  it('formats a fractional value below display precision', () => {
    expect(formatRate(0.04)).toBe('0.0');
  });

  it('formats a non-finite value as an em dash', () => {
    expect(formatRate(Infinity)).toBe('—');
    expect(formatRate(Number.NaN)).toBe('—');
  });
});

describe('formatSignedRate (sign as text, never colour alone)', () => {
  it('prefixes a positive gain with +', () => {
    expect(formatSignedRate(12.3)).toBe('+12.3');
  });

  it('prefixes a negative cost (gate keys) with -', () => {
    expect(formatSignedRate(-4.5)).toBe('-4.5');
  });

  it('a zero rate carries no sign', () => {
    expect(formatSignedRate(0)).toBe('0');
  });

  it('a non-finite value is an em dash', () => {
    expect(formatSignedRate(Infinity)).toBe('—');
  });
});

describe('formatMitigationPct', () => {
  it('formats a typical percentage', () => {
    expect(formatMitigationPct(13.27)).toBe('13.3');
  });

  it('formats zero', () => {
    expect(formatMitigationPct(0)).toBe('0.0');
  });

  it('formats a non-finite value as an em dash', () => {
    expect(formatMitigationPct(Number.NaN)).toBe('—');
  });
});

describe('formatBand (item-level drop label passthrough)', () => {
  it('passes through a non-empty label unchanged', () => {
    expect(formatBand('40–60')).toBe('40–60');
    expect(formatBand('60')).toBe('60');
  });

  it('renders an empty label as an em dash', () => {
    expect(formatBand('')).toBe('—');
  });
});

describe('formatOneShot', () => {
  const labels = { yes: 'Yes', no: 'No' };

  it('true -> yes label', () => {
    expect(formatOneShot(true, labels)).toBe('Yes');
  });

  it('false -> no label', () => {
    expect(formatOneShot(false, labels)).toBe('No');
  });
});

describe('formatPhaseLabel', () => {
  it('matches the shipped phases-explorer mapName composition for a known phase', () => {
    // phase-fact-items.tsx: `${phaseMapDisplayName(intel.phase, lang)} · #${intel.phase}`
    expect(formatPhaseLabel(151, 'en')).toBe('First Strike · #151');
  });

  it('is language-aware', () => {
    expect(formatPhaseLabel(71, 'pt')).toBe('Salão Congelado · #71');
    expect(formatPhaseLabel(71, 'en')).toBe('Frozen Hall · #71');
  });
});

describe('React-free source (formatting module)', () => {
  it('farm-ranking-format.ts has no React import', () => {
    const source = readFileSync(
      `${WEB_PACKAGE_ROOT}/src/features/phases/model/farm-ranking-format.ts`,
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});
