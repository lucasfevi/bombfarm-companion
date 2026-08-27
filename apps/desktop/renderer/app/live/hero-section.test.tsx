import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroSection } from './hero-section';

describe('HeroSection — an empty section renders, it does not disappear', () => {
  it('a section with no heroes still shows its heading and the empty-section line', () => {
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'No heroes here right now.', heroes: [] }),
    );
    expect(html).toContain('data-testid="live-list-benched"');
    expect(html).toContain('Benched');
    expect(html).toContain('data-testid="live-list-benched-empty"');
    expect(html).toContain('No heroes here right now.');
  });

  it('a hidden section and a missing one are distinguishable: the section and heading are always present', () => {
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'No heroes here right now.', heroes: [] }),
    );
    expect(html).toContain('<h3');
  });

  it('heads a subsection with h3, under the Heroes panel own h2 — never a second h2 beside it', () => {
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes: [] }),
    );
    expect(html).not.toContain('<h2');
  });
});

describe('HeroSection — ordering', () => {
  it('renders heroes in exactly the order given, never re-sorted', () => {
    const heroes = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes }),
    );
    const positions = heroes.map((hero) => html.indexOf(`live-hero-card-${hero.id}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('renders one live-hero-card-<id> per hero, keyed by id', () => {
    const heroes = [{ id: 'a' }, { id: 'b' }];
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes }),
    );
    expect(html).toContain('data-testid="live-hero-card-a"');
    expect(html).toContain('data-testid="live-hero-card-b"');
  });
});

describe('HeroSection — trailing content', () => {
  it('renders the caller-supplied trailing node for each hero', () => {
    const heroes = [{ id: 'a' }];
    const html = renderToStaticMarkup(
      createElement(HeroSection, {
        testId: 'live-list-on-field',
        title: 'On the field',
        emptyLine: 'empty',
        heroes,
        renderTrailing: (hero: { id: string }) => createElement('span', { 'data-testid': `trailing-${hero.id}` }),
      }),
    );
    expect(html).toContain('data-testid="trailing-a"');
  });
});

describe('HeroSection — the heading count', () => {
  it('counts the heroes it renders when the caller supplies no header content of its own', () => {
    const heroes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes }),
    );
    expect(html).toMatch(/data-testid="live-list-benched-count"[^>]*>3</);
  });

  it('counts zero rather than dropping the count, so an empty section still reads as a count of none', () => {
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes: [] }),
    );
    expect(html).toMatch(/data-testid="live-list-benched-count"[^>]*>0</);
  });

  it('renders the caller-supplied count instead of the hero total, beside the title', () => {
    const html = renderToStaticMarkup(
      createElement(HeroSection, {
        testId: 'live-list-on-field',
        title: 'Field',
        count: '2/5',
        emptyLine: 'empty',
        heroes: [],
      }),
    );
    expect(html).toMatch(/data-testid="live-list-on-field-count"[^>]*>2\/5</);
    expect(html.indexOf('<h3')).toBeLessThan(html.indexOf('data-testid="live-list-on-field-count"'));
  });
});

describe('HeroSection — the cap hint', () => {
  it('shows the hint when one is given, and nothing at all when none is', () => {
    const withHint = renderToStaticMarkup(
      createElement(HeroSection, {
        testId: 'live-list-on-field',
        title: 'Field',
        hint: 'Upgrade field slots in your skill tree',
        emptyLine: 'empty',
        heroes: [],
      }),
    );
    const without = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-on-field', title: 'Field', emptyLine: 'empty', heroes: [] }),
    );
    expect(withHint).toContain('data-testid="live-list-on-field-hint"');
    expect(withHint).toContain('Upgrade field slots in your skill tree');
    expect(without).not.toContain('data-testid="live-list-on-field-hint"');
  });
});

describe('HeroSection — the energy bar', () => {
  it('gives every hero an energy bar, in every section, whether or not its energy was sent', () => {
    const heroes = [{ id: 'a', energyFraction: 0.4 }, { id: 'b' }];
    const html = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes }),
    );
    expect(html).toContain('data-testid="live-energy-a"');
    expect(html).toContain('data-testid="live-energy-b"');
  });
});

describe('HeroSection — the muted treatment', () => {
  it('mutes every card in the section when the section is muted, and none of them when it is not', () => {
    const heroes = [{ id: 'a' }, { id: 'b' }];
    const muted = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes, muted: true }),
    );
    const plain = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-queued', title: 'Idle', emptyLine: 'empty', heroes }),
    );
    expect(muted.match(/data-muted=""/g)).toHaveLength(2);
    expect(plain).not.toContain('data-muted');
  });
});

describe('HeroSection — section-wide facts', () => {
  it('renders each fact given, separated, and nothing at all when the list is empty', () => {
    const withFacts = renderToStaticMarkup(
      createElement(HeroSection, {
        testId: 'live-list-recovering',
        title: 'Resting',
        facts: ['Full rest cycle 17:30', '3 of 15 skips left today'],
        emptyLine: 'empty',
        heroes: [],
      }),
    );
    const none = renderToStaticMarkup(
      createElement(HeroSection, { testId: 'live-list-recovering', title: 'Resting', facts: [], emptyLine: 'empty', heroes: [] }),
    );
    expect(withFacts).toContain('data-testid="live-list-recovering-facts"');
    expect(withFacts).toContain('Full rest cycle 17:30');
    expect(withFacts).toContain('3 of 15 skips left today');
    expect(none).not.toContain('data-testid="live-list-recovering-facts"');
  });

  it('keeps the facts and the hint on separate lines, so a long hint never crowds the readings', () => {
    const html = renderToStaticMarkup(
      createElement(HeroSection, {
        testId: 'live-list-recovering',
        title: 'Resting',
        facts: ['Full rest cycle 17:30'],
        hint: 'A later house rests more heroes at once',
        emptyLine: 'empty',
        heroes: [],
      }),
    );
    expect(html.indexOf('data-testid="live-list-recovering-facts"')).toBeLessThan(
      html.indexOf('data-testid="live-list-recovering-hint"'),
    );
  });
});
