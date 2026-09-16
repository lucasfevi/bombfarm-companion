/**
 * The market currency control, `language-section.tsx`'s shape (`SettingsSection` → `SettingsRow`)
 * over the searchable `SearchSelect` the Optimizer's phase picker uses — thirty-nine rows is a
 * list to type into, not to scroll — with the not-persisted warning in an always-mounted `Banner`
 * (`docs/no-layout-shift.md` rule 1).
 *
 * Presentational only — `page.tsx` owns the stored currency, the persist warning, and the write;
 * this component reaches for no bridge of its own.
 */
import { useMemo } from 'react';
import { Banner, SearchSelect, SettingsRow, SettingsSection, cn } from '@bombfarm/ui';
import { isMarketQuoteCurrency, type MarketQuoteCurrency, type SettingsWriteReason } from '@bombfarm/contracts';
import { STEAM_CURRENCIES } from '@bombfarm/pricing';
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy, useLocale } from '../../lib/copy';

/** The currency's name in the app's language when the runtime knows it, else the table's. */
function currencyLabel(code: string, fallback: string, bcp47: string): string {
  try {
    return new Intl.DisplayNames([bcp47], { type: 'currency' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

export function MarketSection({
  marketQuoteCurrency,
  onMarketQuoteCurrencyChange,
  persistWarning,
}: {
  marketQuoteCurrency: MarketQuoteCurrency;
  onMarketQuoteCurrencyChange: (next: MarketQuoteCurrency) => void;
  persistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();
  const { bcp47 } = useLocale();
  const options = useMemo(
    () =>
      STEAM_CURRENCIES.map((currency) => ({
        value: currency.code,
        label: `${currency.code} · ${currencyLabel(currency.code, currency.label, bcp47)}`,
      })),
    [bcp47],
  );

  return (
    <SettingsSection title={t.settingsMarketSectionTitle}>
      <SettingsRow
        label={t.settingsMarketQuoteCurrencyLabel}
        help={t.settingsMarketQuoteCurrencyHelp}
        className="[&_label_[data-select]]:w-56"
      >
        <SearchSelect
          options={options}
          value={marketQuoteCurrency}
          onValueChange={(next) => {
            if (isMarketQuoteCurrency(next)) {
              onMarketQuoteCurrencyChange(next);
            }
          }}
          aria-label={t.settingsMarketQuoteCurrencyLabel}
          searchPlaceholder={t.settingsMarketQuoteCurrencySearchPlaceholder}
          emptyLabel={t.settingsMarketQuoteCurrencyNoMatch}
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsMarketQuoteCurrencyNotSavedTitle}
        data-testid="settings-market-quote-currency-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && 'invisible')}
      >
        {persistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]] : ''}
      </Banner>
    </SettingsSection>
  );
}
