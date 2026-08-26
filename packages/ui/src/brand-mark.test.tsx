import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrandMark } from './brand-mark';

function render(props: Parameters<typeof BrandMark>[0] = {}) {
  return renderToStaticMarkup(createElement(BrandMark, props));
}

describe('BrandMark', () => {
  it('renders an inline svg, not an <img> pointed at a file', () => {
    const html = render();
    expect(html).toMatch(/^<svg/);
    expect(html).not.toContain('<img');
  });

  it('sizes to 34px by default, matching the web header mark', () => {
    const html = render();
    expect(html).toContain('width="34"');
    expect(html).toContain('height="34"');
  });

  it('honors a caller-supplied size', () => {
    const html = render({ size: 58 });
    expect(html).toContain('width="58"');
    expect(html).toContain('height="58"');
  });

  it('is decorative — hidden from assistive tech, since it always sits beside the brand name text', () => {
    const html = render();
    expect(html).toContain('aria-hidden="true"');
  });
});
