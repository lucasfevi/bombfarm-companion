import { describe, expect, it } from 'vitest';
import { MARKET_QUOTE_CURRENCIES } from '@bombfarm/contracts';
import { STEAM_CURRENCIES, STEAM_CURRENCY_IDS, steamCurrencyFor } from './currencies.js';
import { priceOverviewUrl } from './endpoints.js';

const APP_ID = 4892010;

describe('the currencies a player may pick and the ids Steam is sent are the same set', () => {
  // Steam does not refuse an id it does not know; it answers in USD (measured 2026-09-15,
  // `currency=48` quoted `$0.85`). So a code offered to the player with no id here is a fetch
  // that silently asks for the wrong currency, and a row here nobody can pick is dead weight.
  it('every selectable code has a Steam id', () => {
    const missing = MARKET_QUOTE_CURRENCIES.filter((code) => STEAM_CURRENCY_IDS[code] === undefined);
    expect(missing).toEqual([]);
  });

  it('every Steam id is selectable', () => {
    const unoffered = STEAM_CURRENCIES.map((currency) => currency.code).filter(
      (code) => !(MARKET_QUOTE_CURRENCIES as readonly string[]).includes(code),
    );
    expect(unoffered).toEqual([]);
  });
});

describe('STEAM_CURRENCIES', () => {
  it('keeps the two ids the desktop has always sent', () => {
    expect(STEAM_CURRENCY_IDS.USD).toBe(1);
    expect(STEAM_CURRENCY_IDS.BRL).toBe(7);
  });

  it('gives each code and each id exactly once', () => {
    const codes = STEAM_CURRENCIES.map((currency) => currency.code);
    const ids = STEAM_CURRENCIES.map((currency) => currency.id);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('labels every row', () => {
    for (const currency of STEAM_CURRENCIES) expect(currency.label.length).toBeGreaterThan(0);
  });

  it('finds a row by code in either case, and none for a code Steam retired', () => {
    expect(steamCurrencyFor('brl')).toMatchObject({ id: 7, label: 'Brazilian Real' });
    expect(steamCurrencyFor('SEK')).toBeNull();
  });
});

describe('priceOverviewUrl', () => {
  it('sends the id of the currency asked for', () => {
    const url = new URL(priceOverviewUrl(APP_ID, 'Topaz Gem', 'TRY'));
    expect(url.searchParams.get('currency')).toBe('17');
  });

  it('falls back to USD for a code with no id — the reason the two lists are held together above', () => {
    const url = new URL(priceOverviewUrl(APP_ID, 'Topaz Gem', 'SEK'));
    expect(url.searchParams.get('currency')).toBe('1');
  });
});
