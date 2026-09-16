import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SearchSelectProps } from '@bombfarm/ui';
import { MARKET_QUOTE_CURRENCIES } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { MarketSection } from './market-section';

// The control is stubbed so its props are observable; the section itself renders for real, hooks
// included, which a direct call of the component function would not allow.
const captured: SearchSelectProps[] = [];
vi.mock('@bombfarm/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@bombfarm/ui')>()),
  SearchSelect: (props: SearchSelectProps) => {
    captured.push(props);
    return null;
  },
}));

function renderSection(onMarketQuoteCurrencyChange: (next: string) => void): SearchSelectProps {
  captured.length = 0;
  renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(MarketSection, {
        marketQuoteCurrency: 'BRL',
        onMarketQuoteCurrencyChange,
        persistWarning: null,
      }),
    }),
  );
  const props = captured[0];
  if (!props) throw new Error('MarketSection rendered no SearchSelect');
  return props;
}

describe('MarketSection — the rendered control is wired to onMarketQuoteCurrencyChange', () => {
  it('a pick of an offered code reaches the callback with that code', () => {
    const onMarketQuoteCurrencyChange = vi.fn();
    const select = renderSection(onMarketQuoteCurrencyChange);

    expect(select.value).toBe('BRL');

    select.onValueChange('USD');
    expect(onMarketQuoteCurrencyChange).toHaveBeenCalledTimes(1);
    expect(onMarketQuoteCurrencyChange).toHaveBeenCalledWith('USD');
  });

  it('a value that is not an offered code never reaches the callback — clearing the search included', () => {
    const onMarketQuoteCurrencyChange = vi.fn();
    const select = renderSection(onMarketQuoteCurrencyChange);

    select.onValueChange('SEK');
    select.onValueChange('');
    expect(onMarketQuoteCurrencyChange).not.toHaveBeenCalled();
  });

  it('every option carries a code the callback accepts, and the search matches on code and name', () => {
    const onMarketQuoteCurrencyChange = vi.fn();
    const select = renderSection(onMarketQuoteCurrencyChange);

    for (const option of select.options) select.onValueChange(option.value);
    expect(onMarketQuoteCurrencyChange).toHaveBeenCalledTimes(MARKET_QUOTE_CURRENCIES.length);

    const brl = select.options.find((option) => option.value === 'BRL');
    expect(brl?.label).toBe('BRL · Brazilian Real');
    expect(select.searchPlaceholder).toBe('USD, Euro, or Real');
    expect(select.emptyLabel).toBe('No currency matches that.');
  });
});
