import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrandMark } from './brand-mark';

const fillsOf = (svg: string) => Array.from(svg.matchAll(/fill="(#[0-9a-f]{6})"/g), (match) => match[1] as string);

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

  it('paints the default tone with the desktop fills, shape by shape', () => {
    const expected = ['#1a1814', '#b96b17', '#b96b17', '#1a1814', '#c4b8a4'];
    expect(fillsOf(render())).toEqual(expected);
    expect(fillsOf(render({ tone: 'default' }))).toEqual(expected);
  });

  it('paints the web tone with the favicon fills, shape by shape', () => {
    expect(fillsOf(render({ tone: 'web' }))).toEqual(['#17100c', '#e78a45', '#e78a45', '#17100c', '#efe6e1']);
  });

  it('keeps the web tone on the same shapes as the favicon, in the same order', () => {
    const favicon = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../apps/web/public/favicon.svg'),
      'utf8',
    );
    expect(fillsOf(render({ tone: 'web' }))).toEqual(fillsOf(favicon));
  });

  it('changes nothing but the fills between tones', () => {
    const strip = (svg: string) => svg.replace(/fill="#[0-9a-f]{6}"/g, 'fill=""');
    expect(strip(render({ tone: 'web' }))).toBe(strip(render()));
  });
});
