import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { formatPhaseLabel } from '@bombfarm/farm/model/farm-ranking-format';
import { formatCompactNumber } from '@bombfarm/ui';
import { FIELD_LABEL_KEY } from '@/features/account';
import { PlannerCard } from '@/features/home/components/planner-card';
import {
  resetHomeRankingCacheForTests,
  selectHomeRankingRows,
} from '@/features/home/model/planner-card-ranking';
import { STRINGS, sub, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectCurrentPhase,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

const LANGS: readonly Lang[] = ['en', 'pt'];
const ACCOUNT_FARM_PHASE = 300;

function hero(id: string, attack: number, { unplaced = false } = {}) {
  const stats = { attack, energy: 120, speed: 60, critChance: 12, critDmg: 80, penetration: 5, cdr: 10, luck: 0 };
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 40,
    stars: 3,
    rank: 'A',
    ...(unplaced ? {} : { power: attack * 10 }),
    naked: stats,
    gearedOverride: stats,
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
}

/** Roster order is not strength order, so a rendered order proves the ranking was followed. */
function hydrate(attacks: readonly number[]): void {
  usePlannerStore.getState().hydrateRoster(
    attacks.map((attack, index) => hero(`h${index + 1}`, attack)),
    'h1',
  );
  usePlannerStore.getState().applyAccountImport({
    tree: null,
    houseIdx: 0,
    houseLevel: 5,
    phase: ACCOUNT_FARM_PHASE,
    maxPhase: 400,
  });
}

const TWELVE = [500, 900, 300, 700, 700, 1100, 200, 800, 600, 1000, 400, 100];

const state = () => usePlannerStore.getState();
const render = () => renderToStaticMarkup(createElement(PlannerCard));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footer = (html: string) => html.slice(openingOf(html, 'home-card-footer'));
const footerLines = (html: string) =>
  [...footer(html).matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map((match) => match[1]);
const rowsOf = (html: string) => body(html).split('<tr').slice(2);
const namesOf = (html: string) => rowsOf(html).map((row) => /Hero h\d+/.exec(row)?.[0]);

describe('the front page planner card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetHomeRankingCacheForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetHomeRankingCacheForTests();
  });

  it('a twelve-hero store renders nine rows in DPS order and says three more heroes', () => {
    hydrate(TWELVE);
    const ranking = selectHomeRankingRows(state());

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();
      const rows = rowsOf(html);

      expect(html).toContain('data-home-card-state="ready"');
      expect(html).toContain(`>${sub(strings.homeCardPlannerContext, { count: 9 })}<`);
      expect(rows).toHaveLength(9);
      expect(namesOf(html)).toEqual(ranking.map((row) => row.heroName));
      rows.forEach((row, index) => {
        expect(row).toContain(`>${formatCompactNumber(ranking[index].dps, lang)}<`);
      });
      expect(body(html)).toContain(`<span class="sr-only">${strings.homeCardPlannerColHero}</span>`);
      expect(body(html)).toContain(`>${strings.homeCardPlannerColPower}<`);
      expect(body(html)).toContain(`>${strings.homeCardPlannerColDps}<`);
      expect(body(html)).toContain(`>${strings.rosterColAbilities}<`);
      expect(footerLines(html)).toEqual([
        sub(strings.homeCardPlannerFooterAccount, {
          phase: formatPhaseLabel(ACCOUNT_FARM_PHASE, lang),
        }),
        sub(strings.homeCardPlannerMore, { count: 3 }),
      ]);
    }
  });

  it('an empty store is in its needs state and prints only the needs line', () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="needs"');
      expect(html).toContain('aria-hidden="true"');
      expect(textOf(body(html))).toBe('');
      expect(textOf(footer(html))).toBe(STRINGS[lang].homeCardPlannerNeedsHeroes);
    }
  });

  it('a four-hero store renders four rows and no more-heroes line', () => {
    hydrate([300, 900, 600, 100]);
    usePlannerStore.setState({ lang: 'en' });
    const html = render();

    expect(rowsOf(html)).toHaveLength(4);
    expect(namesOf(html)).toEqual(['Hero h2', 'Hero h3', 'Hero h1', 'Hero h4']);
    expect(footerLines(html)).toHaveLength(1);
    expect(html).not.toContain('more heroes');
  });

  it('a ten-hero store says one more hero, and a nine-hero store says nothing', () => {
    hydrate(TWELVE.slice(0, 10));
    usePlannerStore.setState({ lang: 'en' });
    const ten = render();
    expect(rowsOf(ten)).toHaveLength(9);
    expect(footerLines(ten)[1]).toBe(sub(STRINGS.en.homeCardPlannerMore, { count: 1 }));

    hydrate(TWELVE.slice(0, 9));
    const nine = render();
    expect(rowsOf(nine)).toHaveLength(9);
    expect(footerLines(nine)).toHaveLength(1);
  });

  it('a hero with no power prints a dash and still prints its DPS', () => {
    usePlannerStore.getState().hydrateRoster([hero('a', 900), hero('b', 300, { unplaced: true })], 'a');
    usePlannerStore.getState().applyAccountImport({ tree: null, houseIdx: 0, houseLevel: 5, phase: 51 });
    usePlannerStore.setState({ lang: 'en' });
    const ranking = selectHomeRankingRows(state());
    const cellsOf = (row: string) =>
      row.split('<td').slice(1).map((cell) => textOf(cell.slice(cell.indexOf('>') + 1)));
    const [withPower, withoutPower] = rowsOf(render()).map(cellsOf);

    expect(withPower[1]).toBe(formatCompactNumber(9000, 'en'));
    expect(withPower[2]).toBe(formatCompactNumber(ranking[0].dps, 'en'));
    expect(withoutPower[1]).toBe('—');
    expect(withoutPower[2]).toBe(formatCompactNumber(ranking[1].dps, 'en'));
    expect(ranking[1].dps).toBeGreaterThan(0);
  });

  it("names the missing account fields with the Account page's labels", () => {
    hydrate(TWELVE);
    usePlannerStore.setState({ missingRequiredFields: ['tree', 'houseLevel', 'maxPhase'] });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();
      const fields = [
        strings[FIELD_LABEL_KEY.tree],
        strings[FIELD_LABEL_KEY.houseLevel],
        strings[FIELD_LABEL_KEY.maxPhase],
      ].join(', ');

      expect(rowsOf(html)).toHaveLength(9);
      expect(footerLines(html)[0]).toBe(sub(strings.homeCardPlannerMissingFields, { fields }));
      expect(footer(html)).not.toContain(strings.homeCardPlannerFooterAccount.split('{')[0]);
    }

    usePlannerStore.setState({ missingRequiredFields: [], phase: null, lang: 'en' });
    expect(footerLines(render())[0]).toBe(
      sub(STRINGS.en.homeCardPlannerMissingFields, { fields: STRINGS.en[FIELD_LABEL_KEY.phase] }),
    );
  });

  it("the footer names the account's phase, or the phase picked on Farm", () => {
    hydrate(TWELVE);
    usePlannerStore.setState({ lang: 'en' });
    expect(footerLines(render())[0]).toBe(
      sub(STRINGS.en.homeCardPlannerFooterAccount, { phase: formatPhaseLabel(ACCOUNT_FARM_PHASE, 'en') }),
    );

    state().setPhasesViewPhase(137);
    expect(state().phasesViewPhaseChosen).toBe(true);
    expect(selectCurrentPhase(state())).toBe(137);
    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      expect(footerLines(render())[0]).toBe(
        sub(STRINGS[lang].homeCardPlannerFooterChosen, { phase: formatPhaseLabel(137, lang) }),
      );
    }
  });

  it('a row is not a control', () => {
    hydrate(TWELVE);
    const html = render();
    const rowSource = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/home/components/planner-card-row.tsx'),
      'utf8',
    );

    const rowTags = rowsOf(html).map((row) => row.slice(0, row.indexOf('>')));
    expect(rowTags).toHaveLength(9);
    for (const tag of rowTags) {
      expect(tag).not.toContain('role=');
      expect(tag).not.toContain('tabindex');
      expect(tag).not.toContain('aria-current');
    }
    expect(html).not.toMatch(/#h\d+/);
    expect(rowSource).not.toContain('onClick');
    expect(rowSource).not.toContain('onKeyDown');
    expect(rowSource).not.toContain('shortId');
    expect(rowSource).toContain('variant="inline"');
  });
});
