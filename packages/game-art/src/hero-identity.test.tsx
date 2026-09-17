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

describe('HeroIdentity — leaving the rarity word out', () => {
  /** The avatar's frame carries the rarity as art; everything after it is the text block. */
  const afterAvatar = (html: string) => html.slice(html.indexOf('<img'));

  it.each(['inline', 'stacked'] as const)(
    'prints the rarity word in its colour by default, in the %s variant',
    (variant) => {
      const html = render({ name: 'Aurora', rarityIdx: 3, level: 42, lang: 'en', variant });
      expect(afterAvatar(html)).toContain('Epic');
      expect(afterAvatar(html)).toContain('text-rar-3');
    },
  );

  it.each(['inline', 'stacked'] as const)(
    'with showRarity off prints neither the word nor a rarity colour past the avatar frame, in the %s variant',
    (variant) => {
      const html = render({ name: 'Aurora', rarityIdx: 3, level: 42, lang: 'en', variant, showRarity: false });
      expect(afterAvatar(html)).not.toContain('Epic');
      expect(afterAvatar(html)).not.toMatch(/text-rar-\d/);
      expect(html).toContain('Aurora');
      expect(html).toContain('Lv 42');
    },
  );

  it('with showRarity off the stacked block is two lines, not three with a blank in the middle', () => {
    const shown = render({ name: 'Aurora', rarityIdx: 3, level: 42, lang: 'en', variant: 'stacked' });
    const hidden = render({ name: 'Aurora', rarityIdx: 3, level: 42, lang: 'en', variant: 'stacked', showRarity: false });
    const lines = (html: string) => (afterAvatar(html).match(/<div class="mt-1/g) ?? []).length;
    expect(lines(shown)).toBe(2);
    expect(lines(hidden)).toBe(1);
    expect(hidden).not.toContain('invisible');
  });

  it('with showRarity off the inline second line is the level and the id alone', () => {
    const html = render({ name: 'Aurora', rarityIdx: 3, level: 42, shortId: '9f', lang: 'en', showRarity: false });
    expect(html).toMatch(/<div class="mt-1[^"]*"><span class="shrink-0 text-muted">Lv 42<span aria-hidden="true"> · <\/span>#9f<\/span><\/div>/);
  });

  it('with showRarity off the avatar frame still carries the rarity', () => {
    const html = render({ name: 'Aurora', rarityIdx: 3, lang: 'en', showRarity: false });
    expect(html.slice(0, html.indexOf('<img'))).toMatch(/rar-3|rarity/);
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
