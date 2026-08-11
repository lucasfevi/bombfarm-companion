import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyState } from './empty-state';

function render(props: Parameters<typeof EmptyState>[0]) {
  return renderToStaticMarkup(createElement(EmptyState, props));
}

describe('EmptyState', () => {
  it('renders the required title as an h2 by default', () => {
    const html = render({ title: 'No game running' });
    expect(html).toMatch(/<h2[^>]*>No game running<\/h2>/);
  });

  it('renders the title as an h3 when headingLevel={3}', () => {
    const html = render({ title: 'No items', headingLevel: 3 });
    expect(html).toMatch(/<h3[^>]*>No items<\/h3>/);
    expect(html).not.toContain('<h2');
  });

  it('renders the title as an h4 when headingLevel={4}', () => {
    const html = render({ title: 'No matches', headingLevel: 4 });
    expect(html).toMatch(/<h4[^>]*>No matches<\/h4>/);
  });

  it('renders description when provided', () => {
    const html = render({ title: 'No game running', description: 'Launch the game to connect.' });
    expect(html).toContain('Launch the game to connect.');
  });

  it('omits description entirely when not provided', () => {
    const html = render({ title: 'No game running' });
    expect(html).not.toContain('<p');
  });

  it('renders action when provided', () => {
    const html = render({
      title: 'No game running',
      action: createElement('button', { type: 'button' }, 'Retry'),
    });
    expect(html).toContain('Retry');
  });

  it('omits action wrapper entirely when not provided', () => {
    const html = render({ title: 'No game running' });
    expect(html).not.toContain('mt-2');
  });

  it('omits icon entirely when not provided', () => {
    const html = render({ title: 'No game running' });
    // No decorative icon wrapper span should be present when icon is unset.
    expect(html).not.toContain('aria-hidden="true"');
  });

  it('renders the icon when provided', () => {
    const html = render({ title: 'No game running', icon: 'x-mark' });
    expect(html).toContain('aria-hidden="true"');
  });

  it('is centered within its own container, not the viewport', () => {
    const html = render({ title: 'No game running' });
    expect(html).not.toContain('h-screen');
    expect(html).not.toContain('fixed');
    expect(html).toContain('items-center');
  });
});
