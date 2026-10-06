import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { EMPTY_DECONSTRUCT_FILTER, type DeconstructFilter } from '../../lib/deconstruct/deconstruct-rows';
import { deconstructLabels } from './deconstruct-labels';
import { DeconstructToolbar, type DeconstructAddAll } from './deconstruct-toolbar';

const labels = deconstructLabels(en, 'en', 'en');

const SETS = [
  { set: 'ember', level: 10, count: 2 },
  { set: 'glacier', level: 60, count: 5 },
];

type Overrides = {
  filter?: Partial<DeconstructFilter>;
  kinds?: Parameters<typeof DeconstructToolbar>[0]['kinds'];
  rarities?: number[];
  sets?: typeof SETS;
  slots?: string[];
  levelBounds?: { min: number; max: number } | null;
  topForge?: number | null;
  anyInStash?: boolean;
  addAll?: Partial<DeconstructAddAll>;
};

function renderToolbar(overrides: Overrides = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(DeconstructToolbar, {
        filter: { ...EMPTY_DECONSTRUCT_FILTER, ...overrides.filter },
        onFilterChange: () => {},
        kinds: overrides.kinds ?? ['equipment', 'gem'],
        rarities: overrides.rarities ?? [0, 1, 3],
        sets: overrides.sets ?? SETS,
        slots: overrides.slots ?? ['arma', 'bota'],
        levelBounds: overrides.levelBounds === undefined ? { min: 10, max: 60 } : overrides.levelBounds,
        topForge: overrides.topForge === undefined ? 5 : overrides.topForge,
        anyInStash: overrides.anyInStash ?? true,
        shown: 4,
        total: 9,
        addAll: { count: 3, block: null, busy: false, onPress: () => {}, ...overrides.addAll },
        labels,
      }),
    }),
  );
}

function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

const isOff = (tag: string) => /\sdisabled[\s=>]/.test(tag);

describe('DeconstructToolbar', () => {
  it('opens on the search field alone, then the dropdowns and ranges, then the kind and rarity chips, then the switches', () => {
    const html = renderToolbar();
    const order = [
      en.deconstructSearchLabel,
      en.inventoryFilterSetsLabel,
      en.forgeSlotLabel,
      en.deconstructLocationLabel,
      en.deconstructLevelLabel,
      en.deconstructForgeUpToLabel,
      en.deconstructKindsLabel,
      en.deconstructRaritiesLabel,
      en.deconstructHideForged,
    ].map((needle) => {
      const at = html.indexOf(needle);
      expect(at, `"${needle}" is not in the toolbar`).toBeGreaterThan(-1);
      return at;
    });
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('offers a chip for every kind and rarity present, and none for what the account does not hold', () => {
    const html = renderToolbar({ kinds: ['equipment', 'rune'], rarities: [0, 3] });
    expect(html.match(/data-testid="deconstruct-kind-chip"/g)).toHaveLength(2);
    expect(html).toContain('Gear');
    expect(html).toContain('Runes');
    expect(html).not.toContain('Gems');
    expect(html.match(/data-testid="deconstruct-rarity-chip"/g)).toHaveLength(2);
    expect(html).not.toContain('>Uncommon<');
  });

  it('marks the chips and switches that are on as pressed, with the hide switch on by default', () => {
    const html = renderToolbar({ filter: { kinds: ['gem'], hideForged: true } });
    expect(tagOf(html, 'deconstruct-hide-unburnable')).toContain('aria-pressed="true"');
    expect(tagOf(html, 'deconstruct-hide-forged')).toContain('aria-pressed="true"');
    expect(tagOf(html, 'deconstruct-selected-only')).toContain('aria-pressed="false"');
    expect(html).toMatch(/data-kind="gem"[^>]*>|aria-pressed="true"[^>]*data-kind="gem"/);
  });

  it('drops the controls that have nothing to offer rather than showing them idle', () => {
    const bare = renderToolbar({ sets: [], slots: [], levelBounds: null, topForge: null, anyInStash: false, kinds: ['equipment'], rarities: [1] });
    expect(bare).not.toContain(en.inventoryFilterSetsLabel);
    expect(bare).not.toContain(en.forgeSlotLabel);
    expect(bare).not.toContain(en.deconstructLocationLabel);
    expect(bare).not.toContain('data-testid="deconstruct-level-range"');
    expect(bare).not.toContain('data-testid="deconstruct-forge-ceiling"');
    expect(bare).not.toContain(en.deconstructKindsLabel);
    expect(bare).not.toContain(en.deconstructRaritiesLabel);
  });

  it('has no level range for gear that all stands on one level — there is nothing it could narrow', () => {
    expect(renderToolbar({ levelBounds: { min: 60, max: 60 } })).not.toContain('data-testid="deconstruct-level-range"');
  });

  it('keeps a control on screen while its filter is on, even once the account has nothing left to offer it', () => {
    const html = renderToolbar({
      filter: { kinds: ['gem'], rarities: [1], slot: 'arma', sets: ['ember'], location: 'stash' },
      kinds: ['equipment'],
      rarities: [1],
      sets: SETS.slice(0, 1),
      slots: ['arma'],
      anyInStash: false,
    });
    expect(html).toContain(en.deconstructKindsLabel);
    expect(html).toContain(en.deconstructRaritiesLabel);
    expect(html).toContain(en.inventoryFilterSetsLabel);
    expect(html).toContain(en.forgeSlotLabel);
    expect(html).toContain(en.deconstructLocationLabel);
  });

  it('names a set picker that reads as every set until it is narrowed', () => {
    expect(renderToolbar()).toContain(en.inventoryFilterAllSets);
    expect(renderToolbar({ filter: { sets: ['ember'] } })).toContain('1 of 2 sets');
  });

  it('shows the clear control only once a filter is on, in the accent fill at the field height', () => {
    expect(renderToolbar()).not.toContain('data-testid="deconstruct-clear-filter"');
    const clear = tagOf(renderToolbar({ filter: { hideUnburnable: false } }), 'deconstruct-clear-filter');
    expect(clear).toContain('bg-accent');
    expect(clear).toContain('h-[30px]');
  });

  it('disables the forge ceiling together with hide-forged, which already is that ceiling at zero', () => {
    expect(renderToolbar()).not.toContain('<fieldset disabled=""');
    expect(renderToolbar({ filter: { hideForged: true } })).toContain('<fieldset disabled=""');
  });

  it('counts the rows shown against the rows the account could burn', () => {
    expect(renderToolbar()).toContain('4 of 9');
  });

  it('puts the add-all button beside the result count, with the number of rows it would add in its label', () => {
    const html = renderToolbar({ addAll: { count: 48 } });
    expect(html.indexOf('data-testid="deconstruct-result-count"')).toBeLessThan(html.indexOf('data-testid="deconstruct-select-shown"'));
    expect(html).toContain('Add all 48 to the batch');
    expect(isOff(tagOf(html, 'deconstruct-select-shown'))).toBe(false);
  });

  it('keeps the add-all button the same width whatever the number, so the count beside it does not slide', () => {
    expect(tagOf(renderToolbar({ addAll: { count: 4 } }), 'deconstruct-select-shown')).toContain('min-w-[11.5rem]');
    expect(tagOf(renderToolbar({ addAll: { count: 4 } }), 'deconstruct-select-shown')).toContain('tabular-nums');
  });

  it('turns the add-all button off when there is nothing to add, and while a burn is in flight', () => {
    expect(isOff(tagOf(renderToolbar({ addAll: { count: 0, block: 'all-added' } }), 'deconstruct-select-shown'))).toBe(true);
    expect(isOff(tagOf(renderToolbar({ addAll: { count: 0, block: 'nothing-burnable' } }), 'deconstruct-select-shown'))).toBe(true);
    expect(isOff(tagOf(renderToolbar({ addAll: { busy: true } }), 'deconstruct-select-shown'))).toBe(true);
  });

  it('is filters only: the account refresh stands over the list in the shell, not in here', () => {
    const html = renderToolbar({ filter: { hideForged: true } });
    expect(html).not.toContain('data-testid="account-refresh"');
    expect(html).not.toContain(en.farmRefresh);
  });
});
