import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { heroAvatarSrc } from '@bombfarm/domain/wiki-assets';
import { HeroRow } from './hero-row';

describe('HeroRow', () => {
  it('carries the live-hero-row-<id> testid keyed by the hero id', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', name: 'Astra', grade: 'A' } }));
    expect(html).toContain('data-testid="live-hero-row-hero-7"');
  });

  it('renders the hero name when the roster join has resolved one', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', name: 'Astra', grade: 'A' } }));
    expect(html).toContain('Astra');
  });

  it('withholds the rank letter when the name is missing — a grade without a name is half a roster join', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', grade: 'A' } }));
    expect(html).toContain('data-testid="live-hero-row-hero-7-name"');
    expect(html).toContain('hero-7');
    expect(html).not.toContain('>A<');
  });

  it('renders the trailing content passed in, such as a countdown', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, { hero: { id: 'hero-7' }, trailing: createElement('span', { 'data-testid': 'trailing-probe' }, 'x') }),
    );
    expect(html).toContain('data-testid="trailing-probe"');
  });

  it('an id-only hero (no name, grade, rarity, stars or level) renders without throwing, falling back to the id for the name and an em dash for the rank', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7' } }));
    expect(html).toContain('data-testid="live-hero-row-hero-7"');
    expect(html).toContain('data-testid="live-hero-row-hero-7-name"');
    expect(html).toContain('hero-7');
    expect(html).toContain('>—<');
  });

  it('renders the rank letter in accent when present, and an em dash in muted when absent', () => {
    const withGrade = renderToStaticMarkup(
      createElement(HeroRow, { hero: { id: 'hero-7', name: 'Astra', grade: 'S' } }),
    );
    const withoutGrade = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', name: 'Astra' } }));
    expect(withGrade).toContain('text-accent');
    expect(withGrade).toContain('>S<');
    expect(withoutGrade).not.toContain('text-accent');
    expect(withoutGrade).toContain('>—<');
  });

  it('renders the hero name in sentence case, never uppercased by class or markup', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', name: 'Aurora' } }));
    expect(html).toContain('>Aurora<');
    expect(html).not.toContain('uppercase');
  });

  it('renders stars as repeated glyphs only when stars is present and greater than zero', () => {
    const withStars = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', stars: 2 } }));
    const zeroStars = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', stars: 0 } }));
    const noStars = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7' } }));
    expect(withStars).toContain('★★');
    expect(withStars).toContain('text-rar-4');
    expect(zeroStars).not.toContain('★');
    expect(noStars).not.toContain('★');
  });

  it('renders the rarity label, coloured by rarity, only when rarity is present', () => {
    const withRarity = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', rarity: 3 } }));
    const noRarity = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7' } }));
    expect(withRarity).toContain('Epic');
    expect(withRarity).toContain('text-rar-3');
    expect(noRarity).not.toContain('text-rar-3');
  });

  it('renders a HeroAvatar image for every hero, including an id-only one', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7' } }));
    expect(html).toContain('<img');
  });

  it('renders distinct portraits for heroes with distinct joined skins, not the same placeholder for every hero', () => {
    const first = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-a', skin: 2 } }));
    const second = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-b', skin: 6 } }));

    expect(first).toContain(heroAvatarSrc(2));
    expect(second).toContain(heroAvatarSrc(6));
    expect(heroAvatarSrc(2)).not.toBe(heroAvatarSrc(6));
  });

  it('falls back to the neutral placeholder skin when the roster join has not caught up to this hero yet', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7' } }));
    expect(html).toContain(heroAvatarSrc(0));
  });
});
