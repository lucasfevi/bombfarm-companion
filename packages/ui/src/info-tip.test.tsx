import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfoTip } from './info-tip';
import { Tooltip } from './tooltip';

function render(props: Parameters<typeof InfoTip>[0]) {
  return renderToStaticMarkup(createElement(Tooltip.Provider, null, createElement(InfoTip, props)));
}

describe('InfoTip', () => {
  it('is a button that names what it explains and carries the explanation', () => {
    const html = render({ label: 'Protection Scroll', tip: 'A miss keeps the level.' });
    expect(html).toContain('<button');
    expect(html).toContain('aria-label="Protection Scroll: A miss keeps the level."');
  });

  it('draws only the glyph, no text of its own', () => {
    expect(render({ label: 'a', tip: 'b' }).replace(/<[^>]*>/g, '')).toBe('');
  });
});
