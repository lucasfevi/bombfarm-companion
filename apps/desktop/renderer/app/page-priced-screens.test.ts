/**
 * The market currency is one stored value, and every screen that prices something has to be
 * handed it rather than reaching for a default of its own.
 *
 * Two of the three are proven by execution: the desktop smoke suite picks a currency in Settings,
 * crosses into Inventory and then into Account, and reads the symbol off both figures. The Heroes
 * screen prices a hero against the same snapshot but keys it by rarity rather than by item, so the
 * seeded snapshot the smoke spec uses prices nothing there and the crossing cannot be driven yet.
 * Until it can, this reads the prop off the source — which is why the claim is written as one list
 * of three rather than as the two that happen to be covered elsewhere.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

const PRICED_SCREENS = ['<InventoryView', '<HeroesView', '<AccountView'];

describe('every screen that prices something reads the shared market currency', () => {
  it('non-vacuity: the source was read and it does render all three priced screens', () => {
    expect(PRICED_SCREENS.filter((tag) => !source.includes(tag))).toEqual([]);
  });

  it('hands each of them the stored value, never a literal or a default', () => {
    const frozen = PRICED_SCREENS.filter((tag) => {
      const start = source.indexOf(tag);
      const end = source.indexOf('/>', start);
      const element = source.slice(start, end === -1 ? source.indexOf('>', start) : end);
      return !element.includes('marketQuoteCurrency={marketQuoteCurrency}');
    });

    expect(
      frozen,
      'these priced screens are not handed the stored market currency, so they would price in ' +
        'whatever they fall back to while the rest of the app prices in the chosen one',
    ).toEqual([]);
  });
});
