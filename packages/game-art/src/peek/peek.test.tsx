import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ABILITIES } from '@bombfarm/domain/model';
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

/** The card's stat rows, label by label, in the order they are drawn. */
const statLabels = (html: string) =>
  [...html.matchAll(/class="shrink-0 truncate font-semibold text-ink">([^<]+)</g)].map((match) => match[1]);

const dollars = {
  view: { state: 'priced', amount: 12.5, currency: 'USD', basis: 'native', listingUrl: null, quotedUtc: null, listings: 4 },
  labels: {
    amount: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`,
    title: () => 'native, 1 h ago',
    unpriced: () => 'No listing',
  },
} as const;

describe('ItemPeekCard', () => {
  it('names the piece in ink with its forge, then tier, level and the forge multiplier on one line, then every roll it makes', () => {
    const html = render(createElement(ItemPeekCard, { item: helmet, lang: 'en' }));
    expect(html).toContain('class="min-w-0 truncate text-ink">Forest Helm<');
    expect(html).not.toContain('text-rar-4">Forest Helm<');
    expect(html).toContain('+8');
    expect(html).toContain('text-rar-4">Legendary<');
    expect(html).toContain('Lv 100');
    // Five rolls for a Legendary, each scaled to level 100 and forged ×1.64.
    expect(statLabels(html)).toHaveLength(5);
    expect(html).toContain('Energy');
    expect(html).toContain('+57.40%');
    expect(html).toContain('Damage');
    expect(html).toContain('+947.1');
    expect(html).toContain('Forge ×1.64');
  });

  it('prints every one of a Mythic’s six rolls', () => {
    const html = render(createElement(ItemPeekCard, { item: { ...helmet, rarityIdx: 5 }, lang: 'en' }));
    expect(statLabels(html)).toEqual(['Energy', 'Luck', 'Damage', 'Crit', 'Penetration', 'Cooldown']);
  });

  it('draws each roll as the inventory card does: label, dotted leader, then the figure in the accent', () => {
    const html = render(createElement(ItemPeekCard, { item: helmet, lang: 'en' }));
    const row = /class="flex items-baseline gap-1.5 text-\[11px\]">(.*?)<\/span><\/span>/.exec(html);
    expect(row).not.toBeNull();
    expect(row?.[1]).toContain('bg-repeat-x" aria-hidden="true"></span>');
    expect(row?.[1]).toContain('class="shrink-0 font-mono text-[11px] font-medium tabular-nums text-accent">+');
  });

  it('the forge multiplier rides the tier line, in place of the slot and set the name already says', () => {
    const html = visible(render(createElement(ItemPeekCard, { item: helmet, lang: 'en' })));
    const sub = /leading-snug">(.*?)<\/div><\/div><\/div>/.exec(html)?.[1] ?? '';
    expect(sub.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).toBe('Legendary · Lv 100 · Forge ×1.64');
    expect(html).not.toContain('Helm · Forest');

    const unforged = visible(render(createElement(ItemPeekCard, { item: { ...helmet, upgrade: 0 }, lang: 'en' })));
    expect(unforged).not.toContain('Forge');
  });

  it('says what the item is worth — gold, and the market’s quote when the host has one', () => {
    const priced = render(createElement(ItemPeekCard, { item: { ...helmet, sellValueGold: 1234 }, lang: 'en', price: dollars }));
    expect(priced).toContain('data-slot="item-peek-gold"');
    expect(priced).toContain('1,234');
    expect(priced).toContain('USD 12.50');

    const goldOnly = render(createElement(ItemPeekCard, { item: { ...helmet, sellValueGold: 1234 }, lang: 'en' }));
    expect(goldOnly).toContain('1,234');
    expect(goldOnly).not.toContain('USD');

    const catalogBuilt = render(createElement(ItemPeekCard, { item: helmet, lang: 'en' }));
    expect(catalogBuilt).not.toContain('data-slot="item-peek-gold"');
    expect(catalogBuilt).not.toContain('USD');
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

  it('the scope tag sits on the rank line in the head, and nothing follows the figure rows', () => {
    const html = render(createElement(AbilityPeekCard, { id: 'grito_guerra', level: 12, lang: 'en' }));
    const head = html.slice(0, html.indexOf('At rank'));
    expect(head).toMatch(/Rank 12 of 20<\/span><span[^>]*>·<\/span><span[^>]*>team aura<\/span>/);
    expect(html.slice(html.indexOf('At cap'))).not.toContain('team aura');
    expect(html.slice(html.indexOf('At cap'))).not.toContain('own sheet');
  });

  it('every ability the game scopes to the team is tagged as one — Fortuna included, with no switch behind it', () => {
    const teamIds = ABILITIES.filter((ability) => /\bTIME\b/.test(ability.effectText)).map((ability) => ability.id);
    expect(teamIds).toContain('fortuna');
    for (const id of teamIds) {
      expect(render(createElement(AbilityPeekCard, { id, level: 5, lang: 'en' })), id).toContain('team aura');
    }
    expect(render(createElement(AbilityPeekCard, { id: 'matilha', level: 5, lang: 'en' }))).not.toContain('team aura');
  });

  it('a capped ability shows one row — the cap is the rank, so saying it twice says nothing', () => {
    const html = render(createElement(AbilityPeekCard, { id: 'grito_guerra', level: 20, lang: 'en' }));
    expect(html).toContain('Rank 20 of 20');
    expect(html).not.toContain('At rank 20');
    expect(html).toContain('At cap');
    expect(html.match(/\+20% attack/g)).toHaveLength(1);
  });

  it('the abilities the model never prices still read their published figure at the rank and at the cap', () => {
    const cage = render(createElement(AbilityPeekCard, { id: 'caca_hero', level: 5, lang: 'en' }));
    expect(cage).toContain('not modeled');
    expect(cage).toContain('At rank 5');
    expect(cage).toContain('+25% Cage damage');
    expect(cage).toContain('+100% Cage damage');
    for (const id of ['fantasma', 'olho_lapidador', 'veia_ouro', 'fortuna']) {
      expect(render(createElement(AbilityPeekCard, { id, level: 20, lang: 'en' })), id).toContain('At cap');
    }
  });

  it('a second blast reads as a chance and the multiplier it works out to; crit and penetration read in %', () => {
    expect(render(createElement(AbilityPeekCard, { id: 'detonacao_dupla', level: 20, lang: 'en' }))).toContain(
      '30.0% chance (×1.15 damage)',
    );
    expect(render(createElement(AbilityPeekCard, { id: 'olho_clinico', level: 20, lang: 'en' }))).toContain('+40% crit');
    expect(render(createElement(AbilityPeekCard, { id: 'brecha', level: 20, lang: 'en' }))).toContain('+20% penetration');
  });

  it('without a rank it reads the ability alone: the name, the tag, the effect and one cap row', () => {
    const html = render(createElement(AbilityPeekCard, { id: 'grito_guerra', lang: 'en' }));
    expect(html).toContain('War Cry');
    expect(html).toContain('team aura');
    expect(html).not.toContain('Rank ');
    expect(html).not.toContain('/20');
    expect(html).not.toContain('At rank');
    expect(html).toContain('At cap');
    expect(html.match(/\+20% attack/g)).toHaveLength(1);
  });
});

describe('HeroPeekCard', () => {
  it('reads the record: rank, name, stars, tier, level, the sheet and both strips — never the id', () => {
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
    expect(html).toContain('>Power<');
    expect(html).toContain('>48.2k<');
    // The strips are bare art — no rank badge on an ability tile.
    expect(html).not.toContain('13/20');
  });

  it('the gear strip is always eight tiles in slot order, an empty tile standing in for each bare slot', () => {
    const html = render(createElement(HeroPeekCard, { hero: heroPeekData(perrin), lang: 'en' }));
    expect(html.match(/data-slot="empty-gear-slot"/g)).toHaveLength(7);
    expect(html.match(/<img src="\/wiki-assets\/items\/lvl100_helmet_forest\.png"/g)).toHaveLength(1);
    // The one equipped piece is a weapon, the first slot: it leads the strip and the empties follow.
    expect(html.indexOf('<img src="/wiki-assets/items/lvl100_helmet_forest.png"')).toBeLessThan(
      html.indexOf('data-slot="empty-gear-slot"'),
    );
    expect(html).toMatch(/data-slot="empty-gear-slot" class="[^"]*\baspect-\[18\/19\][^"]*\bw-7\b[^"]*" aria-hidden="true"/);
  });

  it('a deployed hero reads no differently — the card says nothing about deployment', () => {
    const html = render(createElement(HeroPeekCard, { hero: heroPeekData({ ...perrin, deployed: true }), lang: 'en' }));
    expect(html).not.toContain('Deployed');
    expect(heroPeekData(perrin)).not.toHaveProperty('deployed');
  });

  it('prints the power figure larger than the name, in the accent, mono and tabular', () => {
    const html = render(createElement(HeroPeekCard, { hero: heroPeekData(perrin), lang: 'en' }));
    expect(html).toMatch(/class="font-mono text-base leading-none font-bold tabular-nums text-accent">48\.2k</);
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

  it('names an ability with no carrier by its name alone', () => {
    const html = render(createElement(AbilityPeek, { id: 'olho_clinico', lang: 'en', children: createElement('i') }));
    expect(html).toMatch(/aria-label="Keen Eye"/);
    expect(html).not.toContain('/20');
  });
});
