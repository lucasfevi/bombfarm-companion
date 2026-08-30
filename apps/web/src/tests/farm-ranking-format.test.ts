import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatBand,
  formatMitigationPct,
  formatOneShot,
  formatPhaseLabel,
  formatRate,
  formatRatePerHour,
  formatSignedRate,
  formatSignedRatePerHour,
} from '@/features/phases/model/farm-ranking-format';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

describe('formatRate', () => {
  it('formats zero', () => {
    expect(formatRate(0, 'en')).toBe('0');
  });

  it('formats a very large value compactly', () => {
    expect(formatRate(1_250_000, 'en')).toBe('1.3m');
  });

  it('formats a fractional value below display precision', () => {
    expect(formatRate(0.04, 'en')).toBe('0.0');
  });

  it('formats a non-finite value as an em dash', () => {
    expect(formatRate(Infinity, 'en')).toBe('—');
    expect(formatRate(Number.NaN, 'en')).toBe('—');
  });
});

describe('formatRatePerHour (the table cell variant — formatRate plus a trailing /h)', () => {
  it('appends /h after the magnitude', () => {
    expect(formatRatePerHour(0, 'en')).toBe('0/h');
    expect(formatRatePerHour(1_250_000, 'en')).toBe('1.3m/h');
  });

  it('a non-finite value stays the bare em dash — no unit on "no data"', () => {
    expect(formatRatePerHour(Infinity, 'en')).toBe('—');
    expect(formatRatePerHour(Number.NaN, 'en')).toBe('—');
  });
});

describe('formatSignedRate (sign as text, never colour alone)', () => {
  it('prefixes a positive gain with +', () => {
    expect(formatSignedRate(12.3, 'en')).toBe('+12.3');
  });

  it('prefixes a negative cost (gate keys) with -', () => {
    expect(formatSignedRate(-4.5, 'en')).toBe('-4.5');
  });

  it('a zero rate carries no sign', () => {
    expect(formatSignedRate(0, 'en')).toBe('0');
  });

  it('a non-finite value is an em dash', () => {
    expect(formatSignedRate(Infinity, 'en')).toBe('—');
  });
});

describe('formatSignedRatePerHour (the keys/hr cell variant — sign, magnitude, then /h)', () => {
  it('the suffix follows the magnitude, after the sign', () => {
    expect(formatSignedRatePerHour(12.3, 'en')).toBe('+12.3/h');
    expect(formatSignedRatePerHour(-4.5, 'en')).toBe('-4.5/h');
    expect(formatSignedRatePerHour(0, 'en')).toBe('0/h');
  });

  it('a non-finite value stays the bare em dash', () => {
    expect(formatSignedRatePerHour(Infinity, 'en')).toBe('—');
  });
});

describe('formatMitigationPct', () => {
  it('formats a typical percentage', () => {
    expect(formatMitigationPct(13.27, 'en')).toBe('13.3');
  });

  it('formats zero', () => {
    expect(formatMitigationPct(0, 'en')).toBe('0.0');
  });

  it('formats a non-finite value as an em dash', () => {
    expect(formatMitigationPct(Number.NaN, 'en')).toBe('—');
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
  it('prints the in-game difficulty + map coordinate, not the wiki flavour name', () => {
    expect(formatPhaseLabel(65, 'en')).toBe('Normal 1-15 (#65)');
    expect(formatPhaseLabel(151, 'en')).toBe('Hard 1-1 (#151)');
  });

  it('is language-aware (the difficulty name translates, the coordinate does not)', () => {
    expect(formatPhaseLabel(151, 'pt')).toBe('Difícil 1-1 (#151)');
    expect(formatPhaseLabel(151, 'en')).toBe('Hard 1-1 (#151)');
  });

  it('carries the # the shipped @bombfarm/domain formatPhaseLabel does not', () => {
    expect(formatPhaseLabel(151, 'en')).not.toBe('Hard 1-1 (151)');
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
