import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { heroAvatarSrc } from '@bombfarm/domain/wiki-assets';
import { STRINGS } from '../../lib/copy';
import { HeroRow } from './hero-row';

const en = STRINGS.en;

describe('HeroRow', () => {
  it('carries the live-hero-row-<id> testid keyed by the hero id', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, { state: 'on-field', hero: { id: 'hero-7', name: 'Astra', grade: 'A' } }),
    );
    expect(html).toContain('data-testid="live-hero-row-hero-7"');
  });

  it('renders the hero name when the roster join has resolved one', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, { state: 'on-field', hero: { id: 'hero-7', name: 'Astra', grade: 'A' } }),
    );
    expect(html).toContain('Astra');
  });

  it('withholds the rank letter when the name is missing — a grade without a name is half a roster join', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', grade: 'A' } }));
    expect(html).toContain('data-testid="live-hero-row-hero-7-name"');
    expect(html).toContain('hero-7');
    expect(html).not.toContain('>A<');
  });

  it('renders the trailing content passed in, such as a countdown', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, {
        state: 'on-field',
        hero: { id: 'hero-7' },
        trailing: createElement('span', { 'data-testid': 'trailing-probe' }, 'x'),
      }),
    );
    expect(html).toContain('data-testid="trailing-probe"');
  });

  it('an id-only hero (no name, grade, rarity or level) renders without throwing, falling back to the id for the name and an em dash for the rank', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'benched', hero: { id: 'hero-7' } }));
    expect(html).toContain('data-testid="live-hero-row-hero-7"');
    expect(html).toContain('data-testid="live-hero-row-hero-7-name"');
    expect(html).toContain('hero-7');
    expect(html).toContain('>—<');
  });

  it('renders the rank letter in accent when present, and an em dash in muted when absent', () => {
    const withGrade = renderToStaticMarkup(
      createElement(HeroRow, { state: 'on-field', hero: { id: 'hero-7', name: 'Astra', grade: 'S' } }),
    );
    const withoutGrade = renderToStaticMarkup(
      createElement(HeroRow, { state: 'on-field', hero: { id: 'hero-7', name: 'Astra' } }),
    );
    expect(withGrade).toContain('text-accent');
    expect(withGrade).toContain('>S<');
    expect(withoutGrade).not.toContain('text-accent');
    expect(withoutGrade).toContain('>—<');
  });

  it('renders the hero name in sentence case, never uppercased by class or markup', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', name: 'Aurora' } }));
    expect(html).toContain('>Aurora<');
    expect(html).not.toContain('uppercase');
  });

  it('carries no rarity chip and no stars — rarity is colour-only now', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', rarity: 3, stars: 2 } }));
    expect(html).not.toContain('★');
    expect(html).not.toContain('Epic');
  });

  it('colours the hero name by rarity when rarity is known', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', name: 'Astra', rarity: 3 } }));
    expect(html).toMatch(/data-testid="live-hero-row-hero-7-name" class="text-rar-3"/);
  });

  it('falls back to a neutral name colour when rarity is unknown', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', name: 'Astra' } }));
    expect(html).not.toContain('text-rar-');
  });

  it('renders a HeroAvatar image for every hero, including an id-only one', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7' } }));
    expect(html).toContain('<img');
  });

  it('renders distinct portraits for heroes with distinct joined skins, not the same placeholder for every hero', () => {
    const first = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-a', skin: 2 } }));
    const second = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-b', skin: 6 } }));

    expect(first).toContain(heroAvatarSrc(2));
    expect(second).toContain(heroAvatarSrc(6));
    expect(heroAvatarSrc(2)).not.toBe(heroAvatarSrc(6));
  });

  it('falls back to the neutral placeholder skin when the roster join has not caught up to this hero yet', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7' } }));
    expect(html).toContain(heroAvatarSrc(0));
  });

  it('gives every hero an energy bar', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7' } }));
    expect(html).toContain('data-testid="live-energy-hero-7"');
  });
});

describe('HeroRow — the state indicator', () => {
  it.each([
    ['on-field', en.liveListOnFieldTitle, 'bg-up'] as const,
    ['recovering', en.liveListRecoveringTitle, 'bg-info'] as const,
    ['queued', en.liveListQueuedTitle, 'bg-warn'] as const,
    ['benched', en.liveListBenchedTitle, 'bg-muted'] as const,
  ])('carries a %s dot coloured to match the summary bar, and announces "%s" for a screen reader', (state, label, dotClass) => {
    const html = renderToStaticMarkup(createElement(HeroRow, { state, hero: { id: 'hero-7' } }));
    expect(html).toMatch(new RegExp(`aria-hidden="true" class="[^"]*\\b${dotClass}\\b[^"]*"`));
    expect(html).toContain(`class="sr-only">${label}<`);
  });
});

describe('HeroRow — the muted treatment', () => {
  it('marks a muted row with data-muted, and leaves an ordinary one unmarked', () => {
    const muted = renderToStaticMarkup(createElement(HeroRow, { state: 'benched', hero: { id: 'hero-7' }, muted: true }));
    const plain = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7' } }));
    expect(muted).toContain('data-muted=""');
    expect(plain).not.toContain('data-muted');
  });

  it('drains colour by attribute alone, so muting never changes the row box and never reflows the list', () => {
    const stripMarker = (html: string) => html.replace(' data-muted=""', '');
    expect(
      stripMarker(renderToStaticMarkup(createElement(HeroRow, { state: 'benched', hero: { id: 'hero-7' }, muted: true }))),
    ).toBe(renderToStaticMarkup(createElement(HeroRow, { state: 'benched', hero: { id: 'hero-7' } })));
  });
});
