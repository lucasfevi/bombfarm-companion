import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

function render(props: Parameters<typeof EmptyState>[0]) {
  return renderToStaticMarkup(createElement(EmptyState, props));
}

describe('EmptyState default size', () => {
  it('renders byte-identically whether size is unset or "default"', () => {
    const props = { title: 'No items', description: 'Add one.', icon: 'x-mark' as const };
    expect(render({ ...props, size: 'default' })).toBe(render(props));
  });

  it('keeps the roomy block, the large icon and the base-size heading', () => {
    const html = render({ title: 'No items', description: 'Add one.', icon: 'x-mark' });
    expect(html).toContain('<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">');
    expect(html).toContain('<h2 class="text-base font-semibold text-ink">No items</h2>');
    expect(html).toContain('<p class="max-w-prose text-sm text-muted">Add one.</p>');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('EmptyState inline size', () => {
  it('uses a compact block with paragraph-scale type', () => {
    const html = render({ size: 'inline', title: 'Nothing here', description: 'Add one to begin.' });
    expect(html).toContain('<div class="flex flex-col items-center gap-1 px-3 py-4 text-center">');
    expect(html).toContain('<h2 class="text-[13px] font-semibold text-ink">Nothing here</h2>');
    expect(html).toContain('<p class="m-0 max-w-prose text-[13px] text-muted">Add one to begin.</p>');
    expect(html).not.toContain('py-10');
    expect(html).not.toContain('text-base');
  });

  it('draws no icon block even when an icon is given', () => {
    const html = render({ size: 'inline', title: 'Nothing here', icon: 'x-mark' });
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).not.toContain('<svg');
  });

  it('still omits the description and action wrapper when unset', () => {
    const html = render({ size: 'inline', title: 'Nothing here' });
    expect(html).not.toContain('<p');
    expect(html).not.toContain('mt-1');
  });

  it('renders the action in a tight wrapper', () => {
    const html = render({
      size: 'inline',
      title: 'Nothing here',
      action: createElement('button', { type: 'button' }, 'Add'),
    });
    expect(html).toContain('<div class="mt-1"><button type="button">Add</button></div>');
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = render({ size: 'inline', title: 'Nothing here', className: 'py-2' });
    expect(html).toContain('py-2');
    expect(html).not.toContain('py-4');
  });
});

describe('EmptyState headingLevel', () => {
  it.each([
    [2, 'h2'],
    [3, 'h3'],
    [4, 'h4'],
  ] as const)('renders level %s as a %s, at either size', (level, tag) => {
    for (const size of ['default', 'inline'] as const) {
      const html = render({ title: 'Nothing here', headingLevel: level, size });
      expect(html).toMatch(new RegExp(`<${tag} class="[^"]*">Nothing here</${tag}>`));
      for (const other of ['h2', 'h3', 'h4'].filter((t) => t !== tag)) {
        expect(html).not.toContain(`<${other}`);
      }
    }
  });

  it('defaults to h2 at the inline size', () => {
    expect(render({ size: 'inline', title: 'Nothing here' })).toContain('<h2 ');
  });
});
