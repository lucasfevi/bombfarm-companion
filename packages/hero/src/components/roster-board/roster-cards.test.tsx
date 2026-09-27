import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ART_TILE_SIZE_VAR, abilityIconRecipe, artFrameRecipe, heroRankFillClass, heroRankToneClass } from '@bombfarm/game-art';
import type { RosterBoardCopy } from '../../copy';
import {
  DEFAULT_SHOWCASE_VIEW,
  SHOWCASE_TILE_SIZE,
  gradeRailFor,
  railTintFor,
  showcaseTileWidthCss,
  type RosterHeroRow,
  type ShowcaseView,
} from '../../model';
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

const WINDOW = { min: 0, max: 100 };
const RANGES = {
  attack: WINDOW,
  energy: WINDOW,
  speed: WINDOW,
  luck: WINDOW,
  critChance: WINDOW,
  critDmg: WINDOW,
  penetration: WINDOW,
  cdr: WINDOW,
};

/** A mean of 44.5, which prints as 45%: CDR and Crit DMG rolled highest. */
const ROLLED = rowFixture({
  id: 'rolled',
  rank: 'C',
  birth: { ...ZERO_SHEET, attack: 80, cdr: 97, critDmg: 94, luck: 85 },
  statRanges: RANGES,
});

const CARD_SECTION_IDS = ['heroes-card-types', 'heroes-card-birth', 'heroes-card-abilities', 'heroes-card-gear'];

function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The markup inside one of a card's sections, up to the section drawn after it. */
function sectionOf(html: string, testId: string): string {
  const start = html.indexOf('>', html.indexOf(`data-testid="${testId}"`)) + 1;
  const next = CARD_SECTION_IDS.map((id) => html.indexOf(`data-testid="${id}"`, start)).filter((at) => at !== -1);
  return html.slice(start, next.length === 0 ? undefined : html.lastIndexOf('<', Math.min(...next)));
}

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

  it('prints the power headline, the type and the level in words', () => {
    const html = render([
      rowFixture({ id: 'full', name: 'Ayla', rank: 'A', level: 166, power: 35_600_000, abilities: { olho_clinico: 20 } }),
    ]);
    expect(html).toContain('35.6m');
    expect(html).toContain('Level 166');
    expect(html).toContain('Crit striker');
    expect(html).toContain('aria-label="Birth grade A"');
  });

  it('draws the birth roll as a section of meters: the overall mean on a ladder, then the two highest rolls', () => {
    const birth = sectionOf(render([ROLLED]), 'heroes-card-birth');
    expect(textOf(birth)).toBe('Birth roll Highest rolls · % of range C Overall 45% CDR 97% Crit DMG 94%');
    expect(birth.match(/data-slot="grade-ladder"/g)).toHaveLength(1);
    expect(birth.match(/data-testid="heroes-card-roll-stat"/g)).toHaveLength(2);
    expect(birth).toContain('grid-cols-[max-content_1fr_4ch]');
  });

  it('prints the same section in Portuguese', () => {
    const birth = sectionOf(render([ROLLED], 'pt'), 'heroes-card-birth');
    expect(textOf(birth)).toBe('Nascimento Pontos fortes · % da faixa C Geral 45% CDR 97% Dano crít. 94%');
  });

  it('puts the ladder marker at the mean, and lifts the grade the hero holds out of the washes', () => {
    const birth = sectionOf(render([ROLLED]), 'heroes-card-birth');
    const marker = /style="left:([\d.]+)%"[^>]*data-slot="grade-ladder-marker"/.exec(birth)?.[1];
    expect(Number(marker)).toBeCloseTo(gradeRailFor(44.5).markerPct, 6);
    const own = /<span data-letter="C" class="([^"]*)"/.exec(birth)?.[1] ?? '';
    expect(own).toContain(heroRankFillClass('C'));
    const other = /<span data-letter="E" class="([^"]*)"/.exec(birth)?.[1] ?? '';
    expect(other).toContain('/30');
  });

  it('tints each highest-roll rail by the same thirds the detail panel uses, on the card track', () => {
    const tinted = rowFixture({
      id: 'tinted',
      birth: { ...ZERO_SHEET, cdr: 97, critDmg: 50 },
      statRanges: RANGES,
    });
    const birth = sectionOf(render([tinted]), 'heroes-card-birth');
    const fills = Array.from(birth.matchAll(/<span class="block h-1 w-full overflow-hidden ([^"]*)"[^>]*><span class="block h-full ([^"]*)" style="width:([\d.]+)%"/g));
    expect(fills.map((fill) => [fill[1], fill[2], fill[3]])).toEqual([
      ['bg-line/60', 'bg-up', '97'],
      ['bg-line/60', 'bg-warn', '50'],
    ]);
    expect(railTintFor(97)).toBe('high');
    expect(railTintFor(50)).toBe('mid');
  });

  it('keeps the section for a hero nothing can be placed for, with a dash rather than a zero', () => {
    const birth = sectionOf(render([rowFixture({ id: 'bare', rank: 'E' })]), 'heroes-card-birth');
    expect(textOf(birth)).toBe('Birth roll E Overall —');
    expect(birth).not.toContain('grade-ladder');
  });

  it('prints the gear average as words and figures, and says so when nothing is worn', () => {
    const loadout = { ...emptyLoadout(), arma: item(120, 12), elmo: item(129, 15, 'ember_elmo') };
    const worn = rowFixture({ id: 'worn', loadout });
    expect(textOf(sectionOf(render([worn]), 'heroes-card-gear-average'))).toBe('Avg Lv 125 · Forge +14');
    expect(textOf(sectionOf(render([worn], 'pt'), 'heroes-card-gear-average'))).toBe('Média Nv 125 · Forja +14');
    expect(textOf(sectionOf(render([rowFixture({ id: 'naked' })]), 'heroes-card-gear-average'))).toBe('Nothing equipped');
  });

  it('draws every gear tile and ability icon at the one size step the card measures from its width', () => {
    const html = render([rowFixture({ id: 'tiles', abilities: SIX_ABILITIES, loadout: WORN })]);
    const gearClass = artFrameRecipe({ size: SHOWCASE_TILE_SIZE, rarity: 2 }).split(' ').find((token) => token.startsWith('w-'));
    const abilityClass = abilityIconRecipe({ size: SHOWCASE_TILE_SIZE }).split(' ').find((token) => token.startsWith('size-'));
    const gear = sectionOf(html, 'heroes-card-gear-average');
    expect(gear.split(gearClass ?? '?').length - 1).toBe(8);
    expect(sectionOf(html, 'heroes-card-abilities').split(abilityClass ?? '?').length - 1).toBe(6);
    expect(html).toContain(`style="${ART_TILE_SIZE_VAR}:${showcaseTileWidthCss()}"`);
    expect(html).toContain('class="@container min-w-0" data-testid="heroes-card-abilities"');
    expect(html).toContain('class="@container mt-auto min-w-0" data-testid="heroes-card-gear"');
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
