import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { heroAvatarSrc } from '@bombfarm/domain/wiki-assets';
import { STRINGS, sub } from '../../lib/copy';
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

describe('HeroRow — the energy reading beside the bar', () => {
  it('prints the same whole percentage the track fills to, for every exact hundredth', () => {
    const disagreeing = Array.from({ length: 101 }, (_, i) => i).filter((i) => {
      const html = renderToStaticMarkup(
        createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', energyFraction: i / 100 } }),
      );
      const fillWidth = /style="width:([^"]*)"/.exec(html)?.[1]?.trim();
      const reading = /data-testid="live-energy-hero-7-value"[^>]*>([^<]*)</.exec(html)?.[1];
      return fillWidth !== `${String(i)}%` || reading !== `${String(i)}%`;
    });
    expect(disagreeing).toEqual([]);
  });

  it('reads as missing, never as 0%, when the fraction was never sent at all', () => {
    const withData = renderToStaticMarkup(
      createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7', energyFraction: 0 } }),
    );
    const withoutData = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'hero-7' } }));
    expect(/data-testid="live-energy-hero-7-value"[^>]*>([^<]*)</.exec(withData)?.[1]).toBe('0%');
    expect(/data-testid="live-energy-hero-7-value"[^>]*>([^<]*)</.exec(withoutData)?.[1]).toBe(en.valueNotAvailable);
  });
});

describe('HeroRow — every row shares one fixed column grid', () => {
  it('renders the identical grid-template-columns class regardless of state, name length, or countdown presence', () => {
    const short = renderToStaticMarkup(createElement(HeroRow, { state: 'queued', hero: { id: 'short-id', name: 'Zo' } }));
    const long = renderToStaticMarkup(
      createElement(HeroRow, {
        state: 'on-field',
        hero: { id: 'long-id', name: 'A Genuinely Very Long Hero Name', grade: 'S', level: 60 },
        trailing: createElement('span', { 'data-testid': 'trailing-probe' }, '1:23'),
      }),
    );
    const gridClassOf = (html: string, id: string) =>
      new RegExp(`<li[^>]*data-testid="live-hero-row-${id}"[^>]*class="([^"]*)"`).exec(html)?.[1];

    const shortClass = gridClassOf(short, 'short-id');
    const longClass = gridClassOf(long, 'long-id');
    expect(shortClass).toBeTruthy();
    expect(shortClass).toContain('grid-cols-[');
    expect(shortClass).toBe(longClass);
  });

  it('wraps the name in a truncating box rather than letting it widen the identity column', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, {
        state: 'queued',
        hero: { id: 'hero-7', name: 'A Genuinely Very Long Hero Name That Keeps Going' },
      }),
    );
    const nameWrapper = /<span class="([^"]*)"><span[^>]*data-testid="live-hero-row-hero-7-name"/.exec(html)?.[1];
    expect(nameWrapper).toMatch(/\btruncate\b/);
    expect(html).toContain('A Genuinely Very Long Hero Name That Keeps Going');
  });

  it('stacks the rank and name on one line, with the level on a second line, both beside the avatar', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, { state: 'on-field', hero: { id: 'hero-7', name: 'Astra', grade: 'A', level: 42 } }),
    );

    const avatarIndex = html.indexOf('<img');
    expect(avatarIndex).toBeGreaterThan(-1);

    const afterAvatar = html.slice(avatarIndex);
    const columnMatch = /<span class="([^"]*\bflex-col\b[^"]*)">/.exec(afterAvatar);
    expect(columnMatch).toBeTruthy();
    const columnIndex = avatarIndex + (columnMatch?.index ?? 0);

    const afterColumn = html.slice(columnIndex);
    const lineMatch = /<span class="([^"]*\bitems-baseline\b[^"]*)">/.exec(afterColumn);
    expect(lineMatch).toBeTruthy();
    const lineIndex = columnIndex + (lineMatch?.index ?? 0);

    const rankIndex = html.indexOf('>A<', lineIndex);
    const nameIndex = html.indexOf('data-testid="live-hero-row-hero-7-name"', lineIndex);
    const levelIndex = html.indexOf(sub(STRINGS.en.liveHeroLevelValue, { level: 42 }), nameIndex);

    expect(rankIndex).toBeGreaterThan(lineIndex);
    expect(nameIndex).toBeGreaterThan(rankIndex);
    expect(levelIndex).toBeGreaterThan(nameIndex);
  });
});
