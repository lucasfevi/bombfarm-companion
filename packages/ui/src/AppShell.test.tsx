import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders title and children', () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        { title: 'Smoke title' },
        createElement('p', { 'data-testid': 'child' }, 'hello'),
      ),
    );
    expect(html).toContain('Smoke title');
    expect(html).toContain('data-testid="child"');
    expect(html).toContain('hello');
  });

  it('defaults title when omitted', () => {
    const html = renderToStaticMarkup(createElement(AppShell, null, 'body'));
    expect(html).toContain('Bomb Farm Companion');
    expect(html).toContain('body');
  });

  it.each(['DEV', 'NIGHTLY', 'BETA'] as const)('renders %s flavor badge', (label) => {
    const html = renderToStaticMarkup(createElement(AppShell, { badge: label }, 'body'));
    expect(html).toContain('data-testid="flavor-badge"');
    expect(html).toContain(`>${label}<`);
  });

  it('omits flavor badge when badge is null', () => {
    const html = renderToStaticMarkup(createElement(AppShell, { badge: null }, 'body'));
    expect(html).not.toContain('data-testid="flavor-badge"');
  });

  it('omits flavor badge when badge is omitted', () => {
    const html = renderToStaticMarkup(createElement(AppShell, null, 'body'));
    expect(html).not.toContain('data-testid="flavor-badge"');
  });
});
