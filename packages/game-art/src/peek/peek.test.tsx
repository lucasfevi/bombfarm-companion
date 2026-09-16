import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { AbilityPeek, AbilityPeekCard } from './ability-peek';
import { HeroPeek, HeroPeekCard, heroPeekData } from './hero-peek';
import { ItemPeek, ItemPeekCard } from './item-peek';

const render = (element: ReactElement) => renderToStaticMarkup(element);
/** The markup with its accessible names removed, so an assertion reads what is drawn. */
const visible = (html: string) => html.replace(/aria-label="[^"]*"/g, '');

const helmet = { defId: 'forest_elmo', rarityIdx: 4, level: 100, upgrade: 8 };

const sheet = { attack: 12480, energy: 61.2, speed: 18.4, critChance: 32.5, critDmg: 145, penetration: 44.1, cdr: 22, luck: 30.8 };

const perrin: HeroRecord = {
  id: 'h-1',
  sourceId: '1234501a2f',
  name: 'Perrin',
  updatedAt: 0,
  rarity: 'Épico',
  level: 127,
  stars: 2,
  rank: 'A',
  power: 48210,
  deployed: true,
  skin: 7,
  naked: sheet,
  gearedOverride: sheet,
  loadout: { arma: helmet, elmo: null },
  altLoadout: null,
  abilities: { golpe_brutal: 13, grito_guerra: 20 },
  pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
};

describe('ItemPeekCard', () => {
  it('names the piece in its tier colour, with its forge, tier and level, then every roll it makes', () => {
    const html = render(createElement(ItemPeekCard, { item: helmet, lang: 'en' }));
    expect(html).toContain('text-rar-4">Forest Helm<');
    expect(html).toContain('+8');
    expect(html).toContain('Legendary');
    expect(html).toContain('Lv 100');
    // Five rolls for a Legendary, each scaled to level 100 and forged ×1.64.
    expect(html).toContain('Energy');
    expect(html).toContain('+57.40%');
    expect(html).toContain('Damage');
    expect(html).toContain('+947.1');
    expect(html).toContain('Helm · Forest');
    expect(html).toContain('Forge ×1.64');
  });

  it('prints the rolls it is handed over the catalog’s, so an inventory row and its card agree', () => {
    const html = render(
      createElement(ItemPeekCard, {
        item: { ...helmet, stats: [{ stat: 'dmg', valor: 19.25, unit: 'flat' }] },
        lang: 'en',
      }),
    );
    expect(html).toContain('+19.3');
    expect(html).not.toContain('+947.1');
  });

  it('a stack says its name and count, and neither a level nor a slot', () => {
    const html = render(
      createElement(ItemPeekCard, {
        item: { defId: 'gem_ruby', rarityIdx: 2, level: 0, upgrade: 0, kind: 'gem', count: 12 },
        lang: 'en',
        name: 'Ruby',
      }),
    );
    expect(html).toContain('Ruby');
    expect(html).toContain('×12');
    expect(html).not.toContain('Lv ');
    expect(html).not.toContain('Forge');
  });

  it('speaks the reader’s language, separators included', () => {
    const html = render(createElement(ItemPeekCard, { item: helmet, lang: 'pt' }));
    expect(html).toContain('Elmo');
    expect(html).toContain('Lendária');
    expect(html).toContain('+947,1');
    expect(html).toContain('Forja ×1,64');
  });
});

describe('AbilityPeekCard', () => {
  it('reads the rank, what a rank does, and the effect at this rank and at the cap', () => {
    const html = render(createElement(AbilityPeekCard, { id: 'golpe_brutal', level: 13, lang: 'en' }));
    expect(html).toContain('Brutal Strike');
    expect(html).toContain('Rank 13 of 20');
    expect(html).toContain('+4% crit damage/level');
    expect(html).toContain('At rank 13');
    expect(html).toContain('+52% crit damage');
    expect(html).toContain('At cap');
    expect(html).toContain('+80% crit damage');
    expect(html).toContain('own sheet');
  });

  it('a team aura is tagged as one, and a capped ability drops the cap line', () => {
    const html = render(createElement(AbilityPeekCard, { id: 'grito_guerra', level: 20, lang: 'en' }));
    expect(html).toContain('team aura');
    expect(html).toContain('At rank 20');
    expect(html).not.toContain('At cap');
  });

  it('an unmodelled ability keeps its effect text and prints no figure', () => {
    const html = render(createElement(AbilityPeekCard, { id: 'caca_hero', level: 5, lang: 'en' }));
    expect(html).toContain('not modeled');
    expect(html).not.toContain('At rank');
  });
});

describe('HeroPeekCard', () => {
  it('reads the record: rank, name, stars, tier, level, id, the sheet, both strips and the footer', () => {
    const html = render(createElement(HeroPeekCard, { hero: heroPeekData(perrin), lang: 'en' }));
    expect(html).toContain('>A<');
    expect(html).toContain('Perrin');
    expect(html).toContain('★★');
    expect(html).toContain('Epic');
    expect(html).toContain('Lv 127');
    expect(html).not.toContain('#01a2f');
    expect(html).toContain('12.5k');
    expect(html).toContain('32.5%');
    expect(html).toContain('/abilities/golpe_brutal.png');
    expect(html).toContain('/items/lvl100_helmet_forest.png');
    expect(html).toContain('Deployed');
    expect(html).toContain('>Power<');
    expect(html).toContain('>48.2k<');
    // The strips are bare art — no rank badge on an ability tile.
    expect(html).not.toContain('13/20');
  });

  it('says only what it was handed — a live row’s identity draws no sheet and no strips', () => {
    const html = render(createElement(HeroPeekCard, { hero: { name: 'Kendo', rank: 'S', rarityIdx: 5, level: 157 }, lang: 'en' }));
    expect(html).toContain('Kendo');
    expect(html).toContain('Mythic');
    expect(html).not.toContain('Attack');
    expect(html).not.toContain('/abilities/');
    expect(html).not.toContain('Power');
  });

  it('reads an import candidate, which has no id yet', () => {
    const { id: _id, sourceId: _sourceId, updatedAt: _at, ...candidate } = perrin;
    expect(heroPeekData(candidate).name).toBe('Perrin');
  });
});

describe('the trigger', () => {
  it('wraps the icon in a hover-only, tab-skipped span that names its subject', () => {
    const html = render(
      createElement(ItemPeek, { item: helmet, lang: 'en', children: createElement('i', null, 'icon') }),
    );
    expect(html).toContain('data-peek="item"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-label="Forest Helm +8. Lv 100 Legendary"');
    expect(html).toContain('<i>icon</i>');
    expect(html).not.toContain('<button');
    // The card mounts on hover, not at rest.
    expect(html).not.toContain('data-peek-card');
  });

  it('around an avatar it carries no name of its own — the avatar’s alt is the hero, and a second name reads as a second image', () => {
    const html = render(
      createElement(HeroPeek, { hero: { name: 'Perrin', rank: 'A' }, lang: 'en', children: createElement('img', { alt: 'Perrin' }) }),
    );
    expect(html).toContain('data-peek="hero"');
    expect(html).not.toContain('aria-label');
    expect(html).not.toContain('role="img"');
  });

  it('disabled, it is not there at all — the icon renders bare', () => {
    const html = render(
      createElement(HeroPeek, { hero: { name: 'Perrin' }, lang: 'en', disabled: true, children: createElement('i', null, 'icon') }),
    );
    expect(html).toBe('<i>icon</i>');
  });

  it('names an ability with its rank, the way the roster row always did', () => {
    const html = render(
      createElement(AbilityPeek, { id: 'olho_clinico', level: 12, lang: 'en', children: createElement('i') }),
    );
    expect(visible(html)).not.toContain('12/20');
    expect(html).toMatch(/aria-label="Keen Eye, 12\/20"/);
  });
});
