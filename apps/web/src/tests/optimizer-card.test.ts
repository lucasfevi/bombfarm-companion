import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { OptimizerCard } from '@/features/home/components/optimizer-card';
import { STRINGS, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

const LANGS: readonly Lang[] = ['en', 'pt'];

const hero = normalizeHero({
  id: 'a',
  name: 'Hero a',
  sourceId: 'src-a',
  updatedAt: 1,
  rarity: 'Raro',
  level: 10,
  stars: 1,
  naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
  gearedOverride: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
  loadout: emptyLoadout(),
  pts: ZERO_PTS(),
  battleAllowed: true,
});

const item: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

const state = () => usePlannerStore.getState();
const render = () => renderToStaticMarkup(createElement(OptimizerCard));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footer = (html: string) => textOf(html.slice(openingOf(html, 'home-card-footer')));
const escaped = (text: string) => text.replace(/'/g, '&#x27;');

describe('the front page optimizer card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it("each of the four missing inputs prints the Optimizer page's own line", () => {
    const fixtures: {
      name: string;
      arrange: () => void;
      key:
        | 'teamPlanEmptyNoRosterTitle'
        | 'teamPlanEmptyNoInventoryTitle'
        | 'teamPlanEmptyAllLeaveAloneTitle'
        | 'teamPlanObjectiveFarmNeedsMaxPhase';
    }[] = [
      { name: 'no roster', arrange: () => {}, key: 'teamPlanEmptyNoRosterTitle' },
      {
        name: 'no inventory',
        arrange: () => state().hydrateRoster([hero], 'a'),
        key: 'teamPlanEmptyNoInventoryTitle',
      },
      {
        name: 'every hero left alone',
        arrange: () => {
          state().hydrateRoster([hero], 'a');
          usePlannerStore.setState({
            inventory: { version: 1, importedAt: 1, items: [item] },
            scopeByHeroId: { a: 'leaveAlone' },
          });
        },
        key: 'teamPlanEmptyAllLeaveAloneTitle',
      },
      {
        name: 'a gold plan with no phase to bound it',
        arrange: () => {
          state().hydrateRoster([hero], 'a');
          usePlannerStore.setState({
            inventory: { version: 1, importedAt: 1, items: [item] },
            scopeByHeroId: { a: 'optimize' },
            objective: 'farm',
            phase: null,
            maxPhase: null,
          });
        },
        key: 'teamPlanObjectiveFarmNeedsMaxPhase',
      },
    ];

    for (const { name, arrange, key } of fixtures) {
      for (const lang of LANGS) {
        resetPlannerStoreForTests();
        arrange();
        usePlannerStore.setState({ lang });
        const html = render();

        expect(html, name).toContain('data-home-card-state="needs"');
        expect(textOf(body(html)), name).toBe('');
        expect(footer(html), name).toBe(escaped(STRINGS[lang][key]));
        expect(html, name).toContain(`>${STRINGS[lang].homeCardOptimizerContext}<`);
      }
    }
  });

  it('with usable inputs the card offers the page and starts no run', () => {
    state().hydrateRoster([hero], 'a');
    usePlannerStore.setState({
      inventory: { version: 1, importedAt: 1, items: [item] },
      scopeByHeroId: { a: 'optimize' },
      objective: 'farm',
      phase: 51,
      maxPhase: 137,
    });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="ready"');
      expect(textOf(body(html))).toBe(STRINGS[lang].homeCardOptimizerReady);
      expect(footer(html)).toBe('');
      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html).not.toContain('<button');
      expect(state().runStatus).toBe('idle');
    }
  });
});
