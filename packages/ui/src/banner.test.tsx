import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Banner, type BannerProps } from './banner';

function render(props: BannerProps) {
  return renderToStaticMarkup(createElement(Banner, props));
}

describe('Banner', () => {
  it('defaults to the warn tone', () => {
    const html = render({ children: 'Heads up' });
    expect(html).toContain('var(--warn)');
    expect(html).not.toContain('var(--down)');
  });

  it('dresses the danger tone in the down colour, with a title in that colour', () => {
    const html = render({ tone: 'danger', title: 'This cannot be undone.', children: 'Gone for good.' });
    expect(html).toContain('border-[color-mix(in_oklch,var(--down)_55%,var(--line))]');
    expect(html).toContain('bg-[color-mix(in_oklch,var(--down)_14%,var(--surface))]');
    expect(html).toMatch(/<h2 class="[^"]*text-down[^"]*">This cannot be undone\.<\/h2>/);
    expect(html).toMatch(/<p class="[^"]*">Gone for good\.<\/p>/);
  });

  it('keeps the ok title green and the warn title uncoloured', () => {
    expect(render({ tone: 'ok', title: 'Ready' })).toMatch(/<h2 class="[^"]*text-up[^"]*">Ready<\/h2>/);
    expect(render({ tone: 'warn', title: 'Careful' })).not.toMatch(/<h2 class="[^"]*text-(up|down)/);
  });

  it('stays a status region and goes full width when embedded', () => {
    const html = render({ tone: 'danger', layout: 'embedded', children: 'x' });
    expect(html).toContain('role="status"');
    expect(html).toContain('max-w-none');
  });

  // renderToStaticMarkup escapes the ampersand in the descendant-selector classes.
  it('gives an ok banner no body-line rule unless asked', () => {
    expect(render({ tone: 'ok', title: 'Ready', children: createElement('p', null, 'Line') })).not.toContain('[&amp;_p]');
  });

  it('applies the body-line size and colour rule to an ok banner with body="sm"', () => {
    const html = render({ tone: 'ok', body: 'sm', title: 'Ready', children: createElement('p', null, 'Line') });
    expect(html).toContain('[&amp;_p]:m-0 [&amp;_p]:text-xs [&amp;_p]:leading-[1.45] [&amp;_p]:text-ink');
  });

  it('leaves the warn, danger and info tones unchanged by body="sm", as they already carry the rule', () => {
    for (const tone of ['warn', 'danger', 'info'] as const) {
      const html = render({ tone, children: 'x' });
      expect(html).toContain('[&amp;_p]:text-xs');
      expect(render({ tone, body: 'sm', children: 'x' })).toBe(html);
    }
  });
});
