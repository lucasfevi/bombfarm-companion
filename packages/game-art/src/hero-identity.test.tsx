import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LETTER_BANDS } from '@bombfarm/domain/roll-quality';
import { HeroIdentity } from './hero-identity';
import { heroRankTextClass } from './game-art.recipe';

function render(props: Parameters<typeof HeroIdentity>[0]) {
  return renderToStaticMarkup(createElement(HeroIdentity, props));
}

describe('HeroIdentity', () => {
  it('names a rarity it recognises', () => {
    const html = render({ name: 'Aurora', rarityIdx: 3, lang: 'en', variant: 'stacked' });
    expect(html).toContain('Epic');
  });

  it('treats a rarity index past the end as unknown rather than as a nameless rarity', () => {
    // The roster join accepts any non-negative number, so a tier this list does not know yet
    // arrives here intact. Naming it by index would render an empty line where a rarity belongs.
    const html = render({ name: 'Aurora', rarityIdx: 6, lang: 'en', variant: 'stacked' });
    expect(html).toContain('invisible');
    expect(html).not.toContain('undefined');
  });

  it('treats the -1 a failed rarity lookup returns as unknown', () => {
    const html = render({ name: 'Aurora', rarityIdx: -1, lang: 'en', variant: 'stacked' });
    expect(html).toContain('invisible');
    expect(html).not.toContain('undefined');
  });

  it('renders an id-only hero without inventing a rank, stars or rarity', () => {
    const html = render({ name: 'hero-7', lang: 'en', variant: 'stacked' });
    expect(html).toContain('hero-7');
    expect(html).toContain('—');
    expect(html).not.toContain('★');
    expect(html).not.toContain('undefined');
  });
});

describe('HeroIdentity — the grade colour', () => {
  it('paints each grade in the colour the game prints it, not one accent for all of them', () => {
    const classes = LETTER_BANDS.letters.map((letter) => {
      const html = render({ name: 'Aurora', rank: letter, lang: 'en', variant: 'stacked' });
      const expected = heroRankTextClass(letter);
      expect(expected, `${letter} has a colour`).toBeDefined();
      expect(html, `${letter} is painted`).toContain(expected as string);
      return expected;
    });

    // Six grades, six different colours — otherwise the assertions above pass on one flat tone.
    expect(new Set(classes).size).toBe(LETTER_BANDS.letters.length);
  });

  it('keeps a grade the table does not know visible rather than muting it like an absent one', () => {
    const unknown = render({ name: 'Aurora', rank: 'Z', lang: 'en', variant: 'stacked' });
    const absent = render({ name: 'Aurora', lang: 'en', variant: 'stacked' });

    expect(unknown).toContain('text-accent');
    expect(unknown).toContain('Z');
    expect(absent).toContain('text-muted');
  });
});
