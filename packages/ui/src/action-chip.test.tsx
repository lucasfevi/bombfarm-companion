import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionChip, type ActionChipTone } from './action-chip';

function render(props: Parameters<typeof ActionChip>[0]) {
  return renderToStaticMarkup(createElement(ActionChip, props));
}

/** Strips tags so we can assert the visible/announced text content only. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

describe('ActionChip', () => {
  it('is a button, so it is focusable and activates on Enter without a keydown handler', () => {
    expect(render({ label: 'Update available' })).toMatch(/^<button /);
  });

  it('does not submit the form it might one day sit inside', () => {
    expect(render({ label: 'Update available' })).toContain('type="button"');
  });

  it.each(['active', 'muted', 'warn'] as ActionChipTone[])('renders the label under the %s tone', (tone) => {
    expect(textOf(render({ label: 'Update available', tone }))).toBe('Update available');
  });

  it('overrides the trailing-chip defaults its recipe assumes', () => {
    const html = render({ label: 'Update available' });

    expect(html).toContain('cursor-pointer');
    expect(html).not.toContain('cursor-default');
    expect(html).not.toMatch(/class="[^"]*\bml-1\.5\b/);
  });

  it('renders a decorative dot that contributes no text node', () => {
    const html = render({ label: 'Update available' });

    expect(html).toMatch(/<span aria-hidden="true"[^>]*><\/span>/);
  });

  it('forwards className and arbitrary button props', () => {
    const html = render({ label: 'Update available', className: 'my-marker', 'aria-label': 'go' });

    expect(html).toContain('my-marker');
    expect(html).toContain('aria-label="go"');
  });

  it('rendered className contains no raw palette token', () => {
    const html = render({ label: 'Update available', tone: 'warn' });

    expect(html).not.toMatch(/emerald|amber|slate|zinc/);
    expect(html).not.toMatch(/--bf-/);
  });
});
