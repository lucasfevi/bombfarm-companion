import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroList } from './hero-list';

describe('HeroList — an empty list renders, it does not disappear', () => {
  it('a list with no heroes still shows its heading and the empty-list line', () => {
    const html = renderToStaticMarkup(
      createElement(HeroList, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'No heroes here right now.', heroes: [] }),
    );
    expect(html).toContain('data-testid="live-list-benched"');
    expect(html).toContain('Benched');
    expect(html).toContain('data-testid="live-list-benched-empty"');
    expect(html).toContain('No heroes here right now.');
  });

  it('a hidden section and a missing one are distinguishable: the panel and heading are always present', () => {
    const html = renderToStaticMarkup(
      createElement(HeroList, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'No heroes here right now.', heroes: [] }),
    );
    expect(html).toContain('<h2');
  });
});

describe('HeroList — ordering', () => {
  it('renders heroes in exactly the order given, never re-sorted', () => {
    const heroes = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    const html = renderToStaticMarkup(
      createElement(HeroList, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes }),
    );
    const positions = heroes.map((hero) => html.indexOf(`live-hero-row-${hero.id}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('renders one live-hero-row-<id> per hero, keyed by id', () => {
    const heroes = [{ id: 'a' }, { id: 'b' }];
    const html = renderToStaticMarkup(
      createElement(HeroList, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes }),
    );
    expect(html).toContain('data-testid="live-hero-row-a"');
    expect(html).toContain('data-testid="live-hero-row-b"');
  });
});

describe('HeroList — trailing content', () => {
  it('renders the caller-supplied trailing node for each hero', () => {
    const heroes = [{ id: 'a' }];
    const html = renderToStaticMarkup(
      createElement(HeroList, {
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

describe('HeroList — header trailing content', () => {
  it('renders the caller-supplied node in the panel header, after the title', () => {
    const html = renderToStaticMarkup(
      createElement(HeroList, {
        testId: 'live-list-on-field',
        title: 'Field',
        headerTrailing: createElement('span', { 'data-testid': 'field-count' }, '2/5'),
        emptyLine: 'empty',
        heroes: [],
      }),
    );
    expect(html).toContain('data-testid="field-count"');
    expect(html).toContain('2/5');
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('data-testid="field-count"'));
  });

  it('renders no extra header markup when headerTrailing is omitted', () => {
    const html = renderToStaticMarkup(
      createElement(HeroList, { testId: 'live-list-benched', title: 'Benched', emptyLine: 'empty', heroes: [] }),
    );
    expect(html).not.toContain('data-testid="field-count"');
  });
});
