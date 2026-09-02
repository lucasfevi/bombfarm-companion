import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../lib/copy';
import { CoffeeButtonLink, CoffeeIconLink } from './coffee-link';

function render(locale: 'en' | 'pt-BR', component: () => ReactElement) {
  return renderToStaticMarkup(
    createElement(CopyProvider, { locale, children: createElement(component) }),
  );
}

describe('CoffeeIconLink — the top-bar shape', () => {
  it('is an anchor at the support page, named for assistive tech', () => {
    const html = render('en', CoffeeIconLink);

    expect(html).toContain('href="https://buymeacoffee.com/lucasfevi"');
    expect(html).toContain('aria-label="Buy me a coffee"');
    expect(html).toContain('data-testid="shell-coffee"');
  });

  it('opens a new context rather than navigating the renderer away from itself', () => {
    const html = render('en', CoffeeIconLink);

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it('carries no visible label of its own — the glyph is the whole control', () => {
    const html = render('en', CoffeeIconLink);

    expect(html).not.toContain('>Buy me a coffee<');
  });

  it('names itself in Portuguese under the Portuguese locale', () => {
    const html = render('pt-BR', CoffeeIconLink);

    expect(html).toContain('aria-label="Me pague um café"');
    expect(html).not.toContain('Buy me a coffee');
  });
});

describe('CoffeeButtonLink — the Settings shape', () => {
  it('reaches the same page, and says so in words', () => {
    const html = render('en', CoffeeButtonLink);

    expect(html).toContain('href="https://buymeacoffee.com/lucasfevi"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('Buy me a coffee');
    expect(html).toContain('data-testid="settings-support-coffee"');
  });

  it('renders its label in Portuguese under the Portuguese locale', () => {
    const html = render('pt-BR', CoffeeButtonLink);

    expect(html).toContain('Me pague um café');
    expect(html).not.toContain('Buy me a coffee');
  });
});
