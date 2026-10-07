export interface SteamCurrency {
  /** The value `priceoverview` takes as `currency`. */
  readonly id: number;
  /** ISO-4217 code, which is also the key a native quote lands under in `lowestNative`. */
  readonly code: string;
  /** The currency's English name, the fallback when the host has no localised name for it. */
  readonly label: string;
  /**
   * How many digits the currency's minor unit has, per ISO-4217. It decides where the decimal
   * point falls in one of Steam's locale-formatted price strings: a trailing group of three
   * digits is grouping in a two-decimal currency and the fraction in a three-decimal one.
   */
  readonly minorUnits: number;
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
  { id: 1, code: 'USD', label: 'US Dollar', minorUnits: 2 },
  { id: 2, code: 'GBP', label: 'British Pound', minorUnits: 2 },
  { id: 3, code: 'EUR', label: 'Euro', minorUnits: 2 },
  { id: 4, code: 'CHF', label: 'Swiss Franc', minorUnits: 2 },
  { id: 5, code: 'RUB', label: 'Russian Ruble', minorUnits: 2 },
  { id: 6, code: 'PLN', label: 'Polish Zloty', minorUnits: 2 },
  { id: 7, code: 'BRL', label: 'Brazilian Real', minorUnits: 2 },
  { id: 8, code: 'JPY', label: 'Japanese Yen', minorUnits: 0 },
  { id: 9, code: 'NOK', label: 'Norwegian Krone', minorUnits: 2 },
  { id: 10, code: 'IDR', label: 'Indonesian Rupiah', minorUnits: 2 },
  { id: 11, code: 'MYR', label: 'Malaysian Ringgit', minorUnits: 2 },
  { id: 12, code: 'PHP', label: 'Philippine Peso', minorUnits: 2 },
  { id: 13, code: 'SGD', label: 'Singapore Dollar', minorUnits: 2 },
  { id: 14, code: 'THB', label: 'Thai Baht', minorUnits: 2 },
  { id: 15, code: 'VND', label: 'Vietnamese Dong', minorUnits: 0 },
  { id: 16, code: 'KRW', label: 'South Korean Won', minorUnits: 0 },
  { id: 17, code: 'TRY', label: 'Turkish Lira', minorUnits: 2 },
  { id: 18, code: 'UAH', label: 'Ukrainian Hryvnia', minorUnits: 2 },
  { id: 19, code: 'MXN', label: 'Mexican Peso', minorUnits: 2 },
  { id: 20, code: 'CAD', label: 'Canadian Dollar', minorUnits: 2 },
  { id: 21, code: 'AUD', label: 'Australian Dollar', minorUnits: 2 },
  { id: 22, code: 'NZD', label: 'New Zealand Dollar', minorUnits: 2 },
  { id: 23, code: 'CNY', label: 'Chinese Yuan', minorUnits: 2 },
  { id: 24, code: 'INR', label: 'Indian Rupee', minorUnits: 2 },
  { id: 25, code: 'CLP', label: 'Chilean Peso', minorUnits: 0 },
  { id: 26, code: 'PEN', label: 'Peruvian Sol', minorUnits: 2 },
  { id: 27, code: 'COP', label: 'Colombian Peso', minorUnits: 2 },
  { id: 28, code: 'ZAR', label: 'South African Rand', minorUnits: 2 },
  { id: 29, code: 'HKD', label: 'Hong Kong Dollar', minorUnits: 2 },
  { id: 30, code: 'TWD', label: 'New Taiwan Dollar', minorUnits: 2 },
  { id: 31, code: 'SAR', label: 'Saudi Riyal', minorUnits: 2 },
  { id: 32, code: 'AED', label: 'UAE Dirham', minorUnits: 2 },
  { id: 34, code: 'ARS', label: 'Argentine Peso', minorUnits: 2 },
  { id: 35, code: 'ILS', label: 'Israeli New Shekel', minorUnits: 2 },
  { id: 37, code: 'KZT', label: 'Kazakhstani Tenge', minorUnits: 2 },
  { id: 38, code: 'KWD', label: 'Kuwaiti Dinar', minorUnits: 3 },
  { id: 39, code: 'QAR', label: 'Qatari Riyal', minorUnits: 2 },
  { id: 40, code: 'CRC', label: 'Costa Rican Colon', minorUnits: 2 },
  { id: 41, code: 'UYU', label: 'Uruguayan Peso', minorUnits: 2 },
];

/** ISO code -> Steam id, the shape `priceOverviewUrl` reads. */
export const STEAM_CURRENCY_IDS: Readonly<Record<string, number>> = Object.fromEntries(
  STEAM_CURRENCIES.map((currency) => [currency.code, currency.id]),
);

export function steamCurrencyFor(code: string): SteamCurrency | null {
  const wanted = code.toUpperCase();
  return STEAM_CURRENCIES.find((currency) => currency.code === wanted) ?? null;
}
