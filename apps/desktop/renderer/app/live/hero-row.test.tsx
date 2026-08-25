import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

  it('a hero with no name renders with its id and no grade (the roster join has not caught up)', () => {
    const html = renderToStaticMarkup(createElement(HeroRow, { hero: { id: 'hero-7', grade: 'A' } }));
    expect(html).toContain('hero-7');
    expect(html).not.toContain('>A<');
  });

  it('renders the trailing content passed in, such as a countdown', () => {
    const html = renderToStaticMarkup(
      createElement(HeroRow, { hero: { id: 'hero-7' }, trailing: createElement('span', { 'data-testid': 'trailing-probe' }, 'x') }),
    );
    expect(html).toContain('data-testid="trailing-probe"');
  });
});
