import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { MarketSection } from './market-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }),
  SETTINGS_WRITE_REASON_COPY_KEY: {
    no_store: 'settingsLanguageReasonNoStore',
    not_writable: 'settingsLanguageReasonNotWritable',
    unknown: 'settingsLanguageReasonUnknown',
  },
}));

function selectElement(props: {
  marketQuoteCurrency: 'BRL';
  onMarketQuoteCurrencyChange: (next: string) => void;
  persistWarning: null;
}) {
  const section = MarketSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown] };
  };
  const settingsRow = section.props.children[0];
  return settingsRow.props.children as {
    props: { value: string; onChange: (event: { target: { value: string } }) => void; children: { props: { value: string } }[] };
  };
}

describe('MarketSection — the rendered control is wired to onMarketQuoteCurrencyChange', () => {
  it('a pick of an offered code reaches the callback with that code', () => {
    const onMarketQuoteCurrencyChange = vi.fn();
    const select = selectElement({ marketQuoteCurrency: 'BRL', onMarketQuoteCurrencyChange, persistWarning: null });

    expect(select.props.value).toBe('BRL');

    select.props.onChange({ target: { value: 'USD' } });
    expect(onMarketQuoteCurrencyChange).toHaveBeenCalledTimes(1);
    expect(onMarketQuoteCurrencyChange).toHaveBeenCalledWith('USD');
  });

  it('a value that is not an offered code never reaches the callback', () => {
    const onMarketQuoteCurrencyChange = vi.fn();
    const select = selectElement({ marketQuoteCurrency: 'BRL', onMarketQuoteCurrencyChange, persistWarning: null });

    select.props.onChange({ target: { value: 'SEK' } });
    select.props.onChange({ target: { value: '' } });
    expect(onMarketQuoteCurrencyChange).not.toHaveBeenCalled();
  });

  it('every option carries a code the callback accepts', () => {
    const select = selectElement({ marketQuoteCurrency: 'BRL', onMarketQuoteCurrencyChange: () => {}, persistWarning: null });
    const onMarketQuoteCurrencyChange = vi.fn();
    const again = selectElement({ marketQuoteCurrency: 'BRL', onMarketQuoteCurrencyChange, persistWarning: null });

    for (const option of select.props.children) again.props.onChange({ target: { value: option.props.value } });
    expect(onMarketQuoteCurrencyChange).toHaveBeenCalledTimes(select.props.children.length);
  });
});
