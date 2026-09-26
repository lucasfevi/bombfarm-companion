import { describe, expect, it } from 'vitest';
import { parseSearchPage, searchRenderUrl } from './endpoints.js';

const APP_ID = 4892010;

describe('searchRenderUrl', () => {
  it('narrows by nothing, because identity comes from the name and not from a facet', () => {
    const url = new URL(searchRenderUrl(APP_ID, 0));

    expect(
      [...url.searchParams.keys()].some((key) => key.startsWith(`category_${String(APP_ID)}_`)),
    ).toBe(false);
  });

  it('asks for the page the caller named, so the walk pages rather than repeating itself', () => {
    expect(new URL(searchRenderUrl(APP_ID, 20)).searchParams.get('start')).toBe('20');
  });

  it('always asks for USD, so a runner in any region produces the same base prices', () => {
    const url = new URL(searchRenderUrl(APP_ID, 0));

    expect(url.searchParams.get('currency')).toBe('1');
    expect(url.searchParams.get('country')).toBe('US');
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
