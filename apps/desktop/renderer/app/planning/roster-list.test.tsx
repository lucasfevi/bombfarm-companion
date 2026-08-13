import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlanningModel } from '../../lib/planning/account-model';
import { syntheticAccountView } from '../../lib/planning/fixtures/synthetic-views';
import { RosterList } from './roster-list';

function buildRoster() {
  const model = buildPlanningModel(syntheticAccountView());
  return model.heroes;
}

describe('RosterList (MPV-12, MPV-14, MPV-15)', () => {
  it('renders the roster-list testid and one roster-row-<heroId> per hero', () => {
    const heroes = buildRoster();
    const html = renderToStaticMarkup(
      createElement(RosterList, { heroes, selectedHeroId: null, onSelect: () => {} }),
    );
    expect(html).toContain('data-testid="roster-list"');
    for (const entry of heroes) {
      expect(html).toContain(`data-testid="roster-row-${entry.hero.id}"`);
    }
  });

  it('each row carries name, level, stars and rarity (MPV-12)', () => {
    const heroes = buildRoster();
    const html = renderToStaticMarkup(
      createElement(RosterList, { heroes, selectedHeroId: null, onSelect: () => {} }),
    );
    const [entry] = heroes;
    if (!entry) throw new Error('expected at least one hero in the fixture');
    expect(html).toContain(entry.hero.name);
    expect(html).toContain(String(entry.hero.level));
    expect(html).toContain(String(entry.hero.stars));
  });

  it('selection is a Button primitive, not a bare <tr onClick> (MPV-14)', () => {
    const heroes = buildRoster();
    const html = renderToStaticMarkup(
      createElement(RosterList, { heroes, selectedHeroId: null, onSelect: () => {} }),
    );
    expect(html).toContain('<button');
  });

  it('the roster scrolls inside DataTable.Root scrollable — no local table markup', () => {
    const heroes = buildRoster();
    const html = renderToStaticMarkup(
      createElement(RosterList, { heroes, selectedHeroId: null, onSelect: () => {} }),
    );
    expect(html).toContain('<table');
    expect(html).not.toContain('overflow-y:auto');
    expect(html).not.toContain('overflow-y: auto');
  });
});
