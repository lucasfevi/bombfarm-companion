import { describe, expect, it } from 'vitest';
import {
  STRINGS,
  formatMoney,
  formatPricesUpdated,
  formatQuoteAge,
  formatQuoteTooltip,
  formatUnpricedLabel,
} from '@/shared/i18n';

const NOW = Date.parse('2026-08-29T12:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe('formatMoney', () => {
  it('renders BRL in the Brazilian grouping the currency is quoted in', () => {
    expect(formatMoney(1234.56, 'pt')).toBe('R$ 1.234,56');
  });

  it('renders BRL in the reader language while keeping the currency symbol', () => {
    expect(formatMoney(1234.56, 'en')).toBe('R$1,234.56');
  });

  it('keeps two decimals on whole and sub-unit amounts', () => {
    expect(formatMoney(7, 'pt')).toBe('R$ 7,00');
    expect(formatMoney(0.4, 'pt')).toBe('R$ 0,40');
  });
});

describe('formatQuoteAge', () => {
  it('reads just now inside the first minute', () => {
    expect(formatQuoteAge(minutesAgo(0), 'en', NOW)).toBe('just now');
    expect(formatQuoteAge(minutesAgo(0), 'pt', NOW)).toBe('agora mesmo');
  });

  it('steps minutes, then hours, then days', () => {
    expect(formatQuoteAge(minutesAgo(45), 'en', NOW)).toBe('45 min ago');
    expect(formatQuoteAge(minutesAgo(6 * 60), 'en', NOW)).toBe('6 h ago');
    expect(formatQuoteAge(minutesAgo(6 * 60), 'pt', NOW)).toBe('há 6 h');
    expect(formatQuoteAge(minutesAgo(3 * 24 * 60), 'en', NOW)).toBe('3 d ago');
    expect(formatQuoteAge(minutesAgo(3 * 24 * 60), 'pt', NOW)).toBe('há 3 d');
  });

  it('rounds down, so an age never claims to be older than it is', () => {
    expect(formatQuoteAge(minutesAgo(119), 'en', NOW)).toBe('1 h ago');
  });

  it('reads just now rather than a negative age when the quote is ahead of the clock', () => {
    expect(formatQuoteAge(new Date(NOW + 60 * 60_000).toISOString(), 'en', NOW)).toBe('just now');
  });

  it('says the time is unknown for a missing or unparsable timestamp', () => {
    expect(formatQuoteAge(null, 'en', NOW)).toBe('at an unknown time');
    expect(formatQuoteAge('whenever', 'pt', NOW)).toBe('em um momento desconhecido');
  });
});

describe('formatPricesUpdated', () => {
  it('dates the line by the quote it was given', () => {
    expect(formatPricesUpdated(minutesAgo(6 * 60), 'en', NOW)).toBe('Prices updated 6 h ago');
    expect(formatPricesUpdated(minutesAgo(6 * 60), 'pt', NOW)).toBe('Preços atualizados há 6 h');
  });
});

describe('formatQuoteTooltip', () => {
  const quotedUtc = minutesAgo(6 * 60);

  it('claims the linked page only for a native quote', () => {
    const native = formatQuoteTooltip(
      { basis: 'native', currency: 'BRL', quotedUtc },
      'en',
      NOW,
    );
    const converted = formatQuoteTooltip(
      { basis: 'converted', currency: 'BRL', quotedUtc },
      'en',
      NOW,
    );

    expect(native).toBe("Steam's own BRL price for this listing, read 6 h ago.");
    expect(converted).toContain('Converted from the USD price');
    expect(converted).toContain('will show a different number');
  });

  it('dates both bases by the quote timestamp, in both languages', () => {
    for (const basis of ['native', 'converted'] as const) {
      expect(formatQuoteTooltip({ basis, currency: 'BRL', quotedUtc }, 'en', NOW)).toContain(
        '6 h ago',
      );
      expect(formatQuoteTooltip({ basis, currency: 'BRL', quotedUtc }, 'pt', NOW)).toContain(
        'há 6 h',
      );
    }
  });

  it('leaves no placeholder unfilled', () => {
    for (const lang of ['en', 'pt'] as const) {
      for (const basis of ['native', 'converted'] as const) {
        expect(
          formatQuoteTooltip({ basis, currency: 'BRL', quotedUtc: null }, lang, NOW),
        ).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe('formatUnpricedLabel', () => {
  it('distinguishes never-tradable from absent-from-market from currently-unlisted', () => {
    expect(formatUnpricedLabel('not-tradable', 'en')).toBe('Not tradable');
    expect(formatUnpricedLabel('unknown', 'en')).toBe('Not on the market');
    expect(formatUnpricedLabel('no-listing', 'en')).toBe('No listings');
  });

  it('translates all three', () => {
    for (const state of ['not-tradable', 'unknown', 'no-listing'] as const) {
      expect(formatUnpricedLabel(state, 'pt')).not.toBe(formatUnpricedLabel(state, 'en'));
    }
  });
});

describe('market strings', () => {
  it('carries every market key in both languages, none left untranslated', () => {
    const leaks: string[] = [];
    for (const key of Object.keys(STRINGS.en)) {
      if (!key.startsWith('market')) continue;
      const enValue = STRINGS.en[key as keyof typeof STRINGS.en];
      const ptValue = STRINGS.pt[key as keyof typeof STRINGS.pt];
      expect(typeof ptValue).toBe('string');
      if (typeof enValue === 'string' && enValue === ptValue) leaks.push(key);
    }
    expect(leaks, `EN string left untranslated in PT: ${leaks.join(', ')}`).toEqual([]);
  });
});
