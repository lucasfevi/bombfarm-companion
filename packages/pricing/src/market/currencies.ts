export interface SteamCurrency {
  /** The value `priceoverview` takes as `currency`. */
  readonly id: number;
  /** ISO-4217 code, which is also the key a native quote lands under in `lowestNative`. */
  readonly code: string;
  /** The currency's English name, the fallback when the host has no localised name for it. */
  readonly label: string;
}

/**
 * Every currency Steam still quotes natively, with the numeric id its market takes.
 *
 * Probed 2026-09-15 against `priceoverview`: the ids Steam retired when their regions moved to
 * the euro (SEK, CZK, RON among them) now answer `success: false`, so they are left out; TRY and
 * ARS, whose store regions moved to USD, still answer in their own currency and stay. An id
 * Steam does not know is not refused — it answers in USD — which is why a code with no row here
 * must never be selectable.
 */
export const STEAM_CURRENCIES: readonly SteamCurrency[] = [
  { id: 1, code: 'USD', label: 'US Dollar' },
  { id: 2, code: 'GBP', label: 'British Pound' },
  { id: 3, code: 'EUR', label: 'Euro' },
  { id: 4, code: 'CHF', label: 'Swiss Franc' },
  { id: 5, code: 'RUB', label: 'Russian Ruble' },
  { id: 6, code: 'PLN', label: 'Polish Zloty' },
  { id: 7, code: 'BRL', label: 'Brazilian Real' },
  { id: 8, code: 'JPY', label: 'Japanese Yen' },
  { id: 9, code: 'NOK', label: 'Norwegian Krone' },
  { id: 10, code: 'IDR', label: 'Indonesian Rupiah' },
  { id: 11, code: 'MYR', label: 'Malaysian Ringgit' },
  { id: 12, code: 'PHP', label: 'Philippine Peso' },
  { id: 13, code: 'SGD', label: 'Singapore Dollar' },
  { id: 14, code: 'THB', label: 'Thai Baht' },
  { id: 15, code: 'VND', label: 'Vietnamese Dong' },
  { id: 16, code: 'KRW', label: 'South Korean Won' },
  { id: 17, code: 'TRY', label: 'Turkish Lira' },
  { id: 18, code: 'UAH', label: 'Ukrainian Hryvnia' },
  { id: 19, code: 'MXN', label: 'Mexican Peso' },
  { id: 20, code: 'CAD', label: 'Canadian Dollar' },
  { id: 21, code: 'AUD', label: 'Australian Dollar' },
  { id: 22, code: 'NZD', label: 'New Zealand Dollar' },
  { id: 23, code: 'CNY', label: 'Chinese Yuan' },
  { id: 24, code: 'INR', label: 'Indian Rupee' },
  { id: 25, code: 'CLP', label: 'Chilean Peso' },
  { id: 26, code: 'PEN', label: 'Peruvian Sol' },
  { id: 27, code: 'COP', label: 'Colombian Peso' },
  { id: 28, code: 'ZAR', label: 'South African Rand' },
  { id: 29, code: 'HKD', label: 'Hong Kong Dollar' },
  { id: 30, code: 'TWD', label: 'New Taiwan Dollar' },
  { id: 31, code: 'SAR', label: 'Saudi Riyal' },
  { id: 32, code: 'AED', label: 'UAE Dirham' },
  { id: 34, code: 'ARS', label: 'Argentine Peso' },
  { id: 35, code: 'ILS', label: 'Israeli New Shekel' },
  { id: 37, code: 'KZT', label: 'Kazakhstani Tenge' },
  { id: 38, code: 'KWD', label: 'Kuwaiti Dinar' },
  { id: 39, code: 'QAR', label: 'Qatari Riyal' },
  { id: 40, code: 'CRC', label: 'Costa Rican Colon' },
  { id: 41, code: 'UYU', label: 'Uruguayan Peso' },
];

/** ISO code -> Steam id, the shape `priceOverviewUrl` reads. */
export const STEAM_CURRENCY_IDS: Readonly<Record<string, number>> = Object.fromEntries(
  STEAM_CURRENCIES.map((currency) => [currency.code, currency.id]),
);

export function steamCurrencyFor(code: string): SteamCurrency | null {
  const wanted = code.toUpperCase();
  return STEAM_CURRENCIES.find((currency) => currency.code === wanted) ?? null;
}
