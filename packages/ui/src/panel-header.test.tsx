import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PanelHeader } from './panel-header';

function render(props: Parameters<typeof PanelHeader>[0]) {
  return renderToStaticMarkup(createElement(PanelHeader, props));
}

describe('PanelHeader', () => {
  it('renders the title as an h2', () => {
    const html = render({ title: 'Points' });
    expect(html).toMatch(/<h2[^>]*>Points<\/h2>/);
  });

  it('dresses the title with the shared panel title recipe (bold uppercase, tracked)', () => {
    const html = render({ title: 'Points' });
    expect(html).toContain('font-bold');
    expect(html).toContain('uppercase');
    expect(html).toContain('tracking-[0.04em]');
  });

  it('renders children after the title, inside the header row', () => {
    const html = render({
      title: 'Points',
      children: createElement('span', { 'data-testid': 'counter' }, '3/10'),
    });
    expect(html).toContain('data-testid="counter"');
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('data-testid="counter"'));
  });



  it('merges a caller className with the header row classes, caller winning on conflicts', () => {
    const html = render({ title: 'Points', className: 'mb-0' });
    expect(html).toContain('mb-0');
    expect(html).not.toContain('mb-2.5');
  });
});
