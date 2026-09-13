import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { HomePage } from '@/features/home';
import { STRINGS, type Lang } from '@/shared/i18n';
import { NAV_SECTIONS, SITE_SECTION_LABEL_KEY } from '@/shared/lib/site-sections';
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

function hero(id: string) {
  const stats = { attack: 10, energy: 10, speed: 10, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 };
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 20,
    stars: 0,
    naked: stats,
    gearedOverride: stats,
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
}

const render = () => renderToStaticMarkup(createElement(HomePage));

const articleLabels = (html: string) =>
  Array.from(html.matchAll(/<article aria-label="([^"]+)"/g), (match) => match[1]);

const wrapperClass = (html: string, slot: string) => {
  const start = html.lastIndexOf('<div', html.indexOf(`data-testid="home-grid-${slot}"`));
  return /class="([^"]*)"/.exec(html.slice(start))?.[1] ?? '';
};

describe('the front page', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    usePlannerStore.setState({ booted: true });
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('renders nothing until the store is booted', () => {
    usePlannerStore.setState({ booted: false, heroes: [hero('a')] });
    expect(render()).toBe('');

    usePlannerStore.setState({ booted: true });
    expect(render()).not.toBe('');
  });

  it('renders the six cards as articles in section order with the nav label as their name', () => {
    usePlannerStore.setState({ heroes: [hero('a')] });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();

      expect(html.match(/<article/g)).toHaveLength(6);
      expect(articleLabels(html)).toEqual([
        ...NAV_SECTIONS.filter((section) => section !== 'home').map(
          (section) => strings[SITE_SECTION_LABEL_KEY[section]],
        ),
        strings.downloadNavLabel,
      ]);
      expect(html).toContain(`>${strings.homeTitle}</h1>`);
      expect(html).toContain(`>${strings.homeSubtitle}</p>`);
      expect(html.indexOf(strings.homeTitle)).toBeLessThan(html.indexOf(strings.homeSubtitle));
      expect(html.indexOf(strings.homeSubtitle)).toBeLessThan(html.indexOf('data-testid="home-status-strip"'));
      expect(html.indexOf('data-testid="home-status-strip"')).toBeLessThan(html.indexOf('<article'));
    }
  });

  it('shows the first-visit block instead of the strip when nothing was ever imported', () => {
    const empty = render();
    expect(empty).toContain('data-testid="home-first-visit"');
    expect(empty).not.toContain('data-testid="home-status-strip"');
    expect(articleLabels(empty)).toHaveLength(6);

    usePlannerStore.setState({ heroes: [hero('a')] });
    const imported = render();
    expect(imported).toContain('data-testid="home-status-strip"');
    expect(imported).not.toContain('data-testid="home-first-visit"');
  });

  it('lays the planner and the farm across two columns and the rest across one', () => {
    const html = render();
    expect(/<div class="([^"]*)" data-testid="home-grid"/.exec(html)?.[1]).toBe(
      'grid grid-cols-1 items-stretch gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4',
    );

    for (const slot of ['planner', 'farm']) {
      expect(wrapperClass(html, slot)).toContain('min-[720px]:col-span-2');
      expect(wrapperClass(html, slot)).not.toContain('col-span-1');
    }
    for (const slot of ['optimizer', 'inventory', 'account', 'live']) {
      expect(wrapperClass(html, slot)).toContain('col-span-1');
      expect(wrapperClass(html, slot)).not.toContain('col-span-2');
    }
  });
});
