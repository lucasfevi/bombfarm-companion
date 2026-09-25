import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RosterBoardCopy } from '../../copy';
import type { RosterHeroRow } from '../../model';
import { ZERO_SHEET, rowFixture } from '../../model/showcase.test-fixture';
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

function render(rows: readonly RosterHeroRow[], lang: 'en' | 'pt' = 'en'): string {
  return renderToStaticMarkup(
    <RosterCards rows={rows} selectedId="" onSelectHeroId={() => undefined} t={HOST_COPY} lang={lang} />,
  );
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

  it('rings and badges Wide Blast only on the hero that owns it, and marks the label row', () => {
    const html = render([
      rowFixture({ id: 'with', abilities: SIX_ABILITIES }),
      rowFixture({ id: 'without', abilities: { olho_clinico: 20 } }),
    ]);
    const withIt = cardOf(html, 'with');
    const withoutIt = cardOf(html, 'without');
    expect(withIt).toContain('data-testid="heroes-card-wide-blast"');
    expect(withIt).toContain('Wide Blast ✓');
    expect(withoutIt).not.toContain('heroes-card-wide-blast');
    expect(withoutIt).not.toContain('Wide Blast');
  });

  it('names the mark in the reader’s language', () => {
    expect(render([rowFixture({ id: 'pt', abilities: SIX_ABILITIES })], 'pt')).toContain('Explosão Ampla ✓');
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

  it('calls a hero with no type-deciding ability unspecialised', () => {
    expect(render([rowFixture({ id: 'plain', abilities: { explosao_ampla: 20 } })])).toContain('Unspecialised');
  });

  it('keeps a benched hero on the board, muted', () => {
    const html = render([rowFixture({ id: 'benched', battleAllowed: false })]);
    expect(cardOf(html, 'benched')).toContain('grayscale');
  });
});
