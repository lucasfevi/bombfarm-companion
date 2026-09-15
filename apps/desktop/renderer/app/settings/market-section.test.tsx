import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MARKET_QUOTE_CURRENCIES } from '@bombfarm/contracts';
import { STEAM_CURRENCIES } from '@bombfarm/pricing';
import { CopyProvider } from '../../lib/copy';
import { MarketSection } from './market-section';

function render(locale: 'en' | 'pt-BR', props: Partial<Parameters<typeof MarketSection>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(MarketSection, {
        marketQuoteCurrency: 'BRL',
        onMarketQuoteCurrencyChange: () => {},
        persistWarning: null,
        ...props,
      }),
    }),
  );
}

describe('MarketSection source — no controls of its own and no account access (docs/base-ui-first.md)', () => {
  const source = readFileSync(join(__dirname, 'market-section.tsx'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('no <select>, <input>, <button> or <label> element literal', () => {
    expect(/<(select|input|button|label)\b/.test(stripped)).toBe(false);
  });

  it('reaches for no bridge of its own — the page owns the write', () => {
    expect(source).not.toContain('window.bfc');
  });

  it('offers the id table itself, so the options and the ids cannot drift apart', () => {
    expect(stripped).toContain('STEAM_CURRENCIES.map(');
    expect(stripped).not.toContain('MARKET_QUOTE_CURRENCIES');
  });
});

describe('MarketSection renders SettingsSection -> SettingsRow -> Select, both locales', () => {
  // Base UI's Select only puts the CURRENTLY SELECTED option's label into static markup — the
  // list is portal-rendered — so the option copy is proven the observable way: the same selected
  // value under each UI language renders a different name.
  it('the selected option is named in the app language, the code in front of it', () => {
    const underEnglishUi = render('en');
    const underPtBrUi = render('pt-BR');
    expect(underEnglishUi).toContain('BRL · Brazilian Real');
    expect(underPtBrUi).toContain('BRL · Real brasileiro');
  });

  it('English: the title, the aria-label and the help all come from copy', () => {
    const html = render('en');
    expect(html).toContain('Market');
    expect(html).toContain('aria-label="Currency for refreshed prices"');
    expect(html).toContain('The shared price list stays converted from USD.');
    expect(html).toContain('role="combobox"');
  });

  it('PT-BR: the title, the aria-label and the help all come from copy — DIFFERENT from English', () => {
    const html = render('pt-BR');
    expect(html).toContain('Mercado');
    expect(html).toContain('aria-label="Moeda dos preços atualizados"');
    expect(html).not.toContain('aria-label="Currency for refreshed prices"');
  });

  it('renders whichever currency is stored, not the default', () => {
    expect(render('en', { marketQuoteCurrency: 'USD' })).toContain('USD · US Dollar');
    expect(render('en', { marketQuoteCurrency: 'TRY' })).toContain('TRY · Turkish Lira');
  });

  it('every selectable currency renders as the selected value — none is missing from the table it draws from', () => {
    for (const code of MARKET_QUOTE_CURRENCIES) {
      expect(render('en', { marketQuoteCurrency: code })).toContain(`${code} · `);
    }
    expect(STEAM_CURRENCIES.map((currency) => currency.code).sort()).toEqual([...MARKET_QUOTE_CURRENCIES].sort());
  });
});

describe('MarketSection — the not-persisted Banner is an always-mounted slot (docs/no-layout-shift.md rule 1)', () => {
  it('persisted (persistWarning: null): the slot is present, empty, and hidden', () => {
    const html = render('en');
    expect(html).toContain('data-testid="settings-market-quote-currency-warning"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('Your save location');
  });

  it("not persisted (persistWarning: 'not_writable'): the reason renders and the slot is visible", () => {
    const html = render('en', { persistWarning: 'not_writable' });
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Currency changed, but not saved');
    expect(html).toContain('Your save location is not writable');
  });

  it("not persisted (persistWarning: 'no_store'), PT-BR: the PT-BR reason renders", () => {
    const html = render('pt-BR', { persistWarning: 'no_store' });
    expect(html).toContain('Moeda alterada, mas não salva');
    expect(html).toContain('indisponível');
  });
});
