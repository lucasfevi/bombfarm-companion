import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { heroRankToneClass } from '@bombfarm/game-art';
import type { RosterBoardCopy } from '../../copy';
import { DEFAULT_SHOWCASE_VIEW, type RosterHeroRow, type ShowcaseView } from '../../model';
import { ZERO_SHEET, item, rowFixture } from '../../model/showcase.test-fixture';
import { RosterCards } from './roster-cards';

const HOST_COPY = new Proxy({}, { get: (_target, key) => String(key) }) as RosterBoardCopy;

const SIX_ABILITIES = {
  olho_clinico: 20,
  golpe_brutal: 17,
  ponta_diamante: 12,
  misericordia: 9,
  fantasma: 4,
  explosao_ampla: 14,
};

function render(
  rows: readonly RosterHeroRow[],
  lang: 'en' | 'pt' = 'en',
  view: ShowcaseView = DEFAULT_SHOWCASE_VIEW,
): string {
  return renderToStaticMarkup(
    <RosterCards
      rows={rows}
      selectedId=""
      onSelectHeroId={() => undefined}
      view={view}
      onViewChange={() => undefined}
      t={HOST_COPY}
      lang={lang}
    />,
  );
}

const WORN = { ...emptyLoadout(), arma: item(124, 13) };

/** The markup of the element the hover lift moves: the peek trigger's one child. */
function liftedArtOf(html: string, marker: string): string {
  const at = html.indexOf(marker);
  const trigger = html.lastIndexOf('data-slot="peek-trigger"', at);
  const child = html.indexOf('<span', trigger);
  return html.slice(child, at + marker.length);
}

function cardOf(html: string, id: string): string {
  const start = html.indexOf(`data-testid="heroes-roster-card-${id}"`);
  const next = html.indexOf('data-testid="heroes-roster-card-', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe('RosterCards', () => {
  it('draws a hero pool as icons with no level on them, and no count of maxed abilities', () => {
    const html = render([rowFixture({ id: 'six', abilities: SIX_ABILITIES })]);
    expect(html.match(/src="[^"]*abilit[^"]*"/g)?.length).toBe(6);
    const visibleText = html.replace(/<[^>]*>/g, ' ');
    expect(visibleText).not.toMatch(/\d+\/\d+/);
    expect(visibleText).not.toMatch(/maxed/i);
  });

  it('rings and badges Wide Blast only on the hero that owns it, with no label in the heading row', () => {
    const html = render([
      rowFixture({ id: 'with', abilities: SIX_ABILITIES }),
      rowFixture({ id: 'without', abilities: { olho_clinico: 20 } }),
    ]);
    const withIt = cardOf(html, 'with');
    const withoutIt = cardOf(html, 'without');
    expect(withIt).toContain('data-testid="heroes-card-wide-blast"');
    expect(withIt).toContain('data-testid="heroes-card-wide-blast-badge"');
    const heading = /data-testid="heroes-card-abilities"><div[^>]*>(.*?)<\/div>/.exec(withIt)?.[1] ?? '';
    expect(heading.replace(/<[^>]*>/g, '')).toBe('Abilities');
    expect(withIt).not.toContain('✓');
    expect(withoutIt).not.toContain('heroes-card-wide-blast');
  });

  it('seats the Wide Blast ring and badge inside the element the hover lifts, beside the art', () => {
    const html = render([rowFixture({ id: 'with', abilities: { explosao_ampla: 14 } })]);
    const lifted = liftedArtOf(html, 'data-testid="heroes-card-wide-blast-badge"');
    expect(lifted.startsWith('<span class="relative inline-flex rounded-sm" data-slot="ability-adorned"')).toBe(true);
    expect(lifted).toContain('explosao_ampla');
    expect(lifted).toContain('data-testid="heroes-card-wide-blast"');
  });

  it('prints no item level, forge or ability level by default', () => {
    const html = render([rowFixture({ id: 'quiet', abilities: SIX_ABILITIES, loadout: WORN })]);
    expect(html).not.toContain('data-slot="item-level"');
    expect(html).not.toContain('data-slot="item-upgrade"');
    expect(html).not.toContain('data-slot="ability-level"');
    expect(html).toContain('data-testid="heroes-card-show-levels"');
  });

  it('prints every item level, forge and ability level when the board asks, over the art', () => {
    const html = render(
      [rowFixture({ id: 'loud', abilities: SIX_ABILITIES, loadout: WORN })],
      'en',
      { showLevels: true },
    );
    expect(html).toMatch(/data-slot="item-level">124</);
    expect(html).toMatch(/data-slot="item-upgrade">\+13</);
    expect(html.match(/data-slot="ability-level"/g)?.length).toBe(6);
    expect(html).toContain('20/20');
    expect(html).not.toMatch(/pb-3\.5/);
  });

  it('numbers each card by its place on the board as ordered', () => {
    const html = render([rowFixture({ id: 'a' }), rowFixture({ id: 'b' })]);
    expect(cardOf(html, 'a')).toContain('>#1<');
    expect(cardOf(html, 'b')).toContain('>#2<');
  });

  it('prints the power headline, the type, the grade and birth roll, and the gear average in words', () => {
    const window = { min: 0, max: 100 };
    const html = render([
      rowFixture({
        id: 'full',
        name: 'Ayla',
        rank: 'A',
        level: 166,
        power: 35_600_000,
        abilities: { olho_clinico: 20 },
        birth: { ...ZERO_SHEET, attack: 80, cdr: 97, critDmg: 94, luck: 85 },
        statRanges: {
          attack: window,
          energy: window,
          speed: window,
          luck: window,
          critChance: window,
          critDmg: window,
          penetration: window,
          cdr: window,
        },
      }),
    ]);
    expect(html).toContain('35.6m');
    expect(html).toContain('Level 166');
    expect(html).toContain('Crit striker');
    expect(html).toContain('aria-label="Birth grade A"');
    expect(html).toContain('Birth roll 45%');
    expect(html).toContain('Highest rolls: CDR 97%, Crit DMG 94%');
    expect(html).toContain('Nothing equipped');
  });

  it('prints the grade as a bare coloured letter, with no chip behind it', () => {
    const html = render([rowFixture({ id: 'graded', rank: 'S' })]);
    const gradeClass = /<span class="([^"]*)"[^>]*data-testid="heroes-card-grade"/.exec(html)?.[1] ?? '';
    expect(gradeClass).toContain(heroRankToneClass('S'));
    expect(gradeClass).not.toMatch(/\b(bg-|border|rounded)/);
  });

  it('calls a hero with no type-deciding ability unspecialised', () => {
    expect(render([rowFixture({ id: 'plain', abilities: { explosao_ampla: 20 } })])).toContain('Unspecialised');
  });

  it('keeps a benched hero on the board, muted', () => {
    const html = render([rowFixture({ id: 'benched', battleAllowed: false })]);
    expect(cardOf(html, 'benched')).toContain('grayscale');
  });
});
