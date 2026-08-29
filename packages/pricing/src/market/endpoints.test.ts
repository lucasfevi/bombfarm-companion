import { describe, expect, it } from 'vitest';
import { parseAppFilters, parseSearchPage, searchRenderUrl } from './endpoints.js';

const APP_ID = 4892010;

describe('searchRenderUrl', () => {
  it('narrows a query using the market UI own facet parameter form', () => {
    const url = new URL(searchRenderUrl(APP_ID, { set: 'ember', slot: 'weapon' }, 0));

    expect(url.searchParams.getAll(`category_${String(APP_ID)}_set[]`)).toEqual(['tag_ember']);
    expect(url.searchParams.getAll(`category_${String(APP_ID)}_slot[]`)).toEqual(['tag_weapon']);
  });

  it('always asks for USD, so a runner in any region produces the same base prices', () => {
    const url = new URL(searchRenderUrl(APP_ID, {}, 0));

    expect(url.searchParams.get('currency')).toBe('1');
    expect(url.searchParams.get('country')).toBe('US');
  });
});

describe('parseAppFilters', () => {
  it('keys the tag lists by the bare facet name, not the appid-prefixed one', () => {
    const filters = parseAppFilters({
      success: true,
      facets: {
        '4892010_rarity': { appid: APP_ID, name: 'rarity', tags: { uncommon: {}, rare: {} } },
      },
    });

    expect(filters).toEqual({ rarity: ['uncommon', 'rare'] });
  });

  it('returns nothing when Steam reports failure, rather than an empty-looking success', () => {
    expect(parseAppFilters({ success: false })).toEqual({});
    expect(parseAppFilters(null)).toEqual({});
  });
});

describe('parseSearchPage', () => {
  it('keeps the lowest listing price and the listing count for each row', () => {
    const page = parseSearchPage({
      success: true,
      total_count: 1,
      results: [
        {
          name: 'Ember Weapon',
          hash_name: 'Ember Weapon',
          sell_price: 166,
          sell_listings: 42,
          asset_description: { icon_url: 'abc', type: 'Uncommon Weapon' },
        },
      ],
    });

    expect(page).toEqual({
      totalCount: 1,
      rows: [
        {
          hashName: 'Ember Weapon',
          name: 'Ember Weapon',
          sellPriceCents: 166,
          listings: 42,
          iconUrl: 'abc',
          type: 'Uncommon Weapon',
        },
      ],
    });
  });

  it('drops a row with no hash name, because nothing downstream can address it', () => {
    const page = parseSearchPage({
      success: true,
      total_count: 2,
      results: [{ name: 'nameless' }, { hash_name: 'Ember Weapon' }],
    });

    expect(page.rows.map((row) => row.hashName)).toEqual(['Ember Weapon']);
  });

  it('reads a row with no price as unpriced rather than free', () => {
    const page = parseSearchPage({
      success: true,
      total_count: 1,
      results: [{ hash_name: 'Ember Weapon' }],
    });

    expect(page.rows[0]?.sellPriceCents).toBeNull();
    expect(page.rows[0]?.listings).toBe(0);
  });
});
