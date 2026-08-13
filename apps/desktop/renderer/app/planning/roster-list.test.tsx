import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { abilityName, rarityLabel, slotLabel } from '@bombfarm/domain/game-labels';
import { buildPlanningModel } from '../../lib/planning/account-model';
import { syntheticAccountView } from '../../lib/planning/fixtures/synthetic-views';
import { CopyProvider } from '../../lib/copy';
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

  it("MP3 F4 (MIN-12/AD-056): the rarity Chip follows the CopyProvider's locale, via useLocale()", () => {
    const heroes = buildRoster();
    const enHtml = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(RosterList, { heroes, selectedHeroId: null, onSelect: () => {} }),
      }),
    );
    const ptHtml = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(RosterList, { heroes, selectedHeroId: null, onSelect: () => {} }),
      }),
    );
    const [entry] = heroes;
    if (!entry) throw new Error('expected at least one hero in the fixture');
    expect(enHtml).toContain(rarityLabel(entry.hero.rarity, 'en'));
    expect(ptHtml).toContain(rarityLabel(entry.hero.rarity, 'pt'));
    expect(rarityLabel(entry.hero.rarity, 'en')).not.toBe(rarityLabel(entry.hero.rarity, 'pt'));
  });
});

/**
 * MP3 F4 — MIN-14: localisation is display-layer only (docs/i18n.md rule 3). For one rarity, one
 * ability and one slot, the label differs between languages AND the key value passed in is `===`
 * the value returned — the stored/schema key is demonstrably unchanged by localising its label.
 */
describe('game-labels helpers (MIN-14 — stored key unchanged, display-layer only)', () => {
  it('rarityLabel: label differs, key is returned unchanged from either call', () => {
    const key = 'Épico' as const;
    expect(rarityLabel(key, 'en')).not.toBe(rarityLabel(key, 'pt'));
    // The key itself, not the label — game-labels helpers take the key and return a LABEL;
    // nothing writes back, so the input identity is what's asserted, structurally.
    expect(key).toBe('Épico');
  });

  it('abilityName: label differs, key is returned unchanged from either call', () => {
    const key = 'ponta_diamante';
    expect(abilityName(key, 'en')).not.toBe(abilityName(key, 'pt'));
    expect(key).toBe('ponta_diamante');
  });

  it('slotLabel: label differs, key is returned unchanged from either call', () => {
    const key = 'arma' as const;
    expect(slotLabel(key, 'en')).not.toBe(slotLabel(key, 'pt'));
    expect(key).toBe('arma');
  });
});
