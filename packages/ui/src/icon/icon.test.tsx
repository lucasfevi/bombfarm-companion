import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Icon } from './icon';
import { isIconName, type IconName } from './registry';

function renderIcon(props: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(Icon, props));
}

describe('Icon', () => {
  it.each([
    ['xs', 'size-3'],
    ['sm', 'size-4'],
    ['md', 'size-5'],
    ['lg', 'size-6'],
  ] as const)('size %s emits %s', (size, utility) => {
    const html = renderIcon({ name: 'gem', size });
    expect(html).toContain(utility);
  });

  it('defaults omitted size to size-4 (sm)', () => {
    const html = renderIcon({ name: 'gem' });
    expect(html).toContain('size-4');
  });

  it('always includes shrink-0', () => {
    const html = renderIcon({ name: 'gem' });
    expect(html).toContain('shrink-0');
  });

  it('merges caller size-3.5 over the recipe without duplicate size utilities', () => {
    const html = renderIcon({ name: 'gem', className: 'size-3.5' });
    expect(html).toContain('size-3.5');
    expect(html).not.toContain('size-4');
  });

  it('merges caller size-2 over the recipe without duplicate size utilities', () => {
    const html = renderIcon({ name: 'gem', className: 'size-2' });
    expect(html).toContain('size-2');
    expect(html).not.toContain('size-4');
  });

  it('renders game glyphs with currentColor fill', () => {
    const html = renderIcon({ name: 'gem' });
    expect(html).toContain('currentColor');
  });

  it('is decorative without label — aria-hidden and focusable, no role or aria-label', () => {
    const html = renderIcon({ name: 'gem' });
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('aria-label');
  });

  it('is labeled when label is a non-empty string', () => {
    const html = renderIcon({ name: 'gem', label: 'Gem icon' });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Gem icon"');
    expect(html).not.toContain('aria-hidden');
  });

  it('treats empty label as decorative', () => {
    const html = renderIcon({ name: 'gem', label: '' });
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it('returns null for an unknown name without logging', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'not-a-glyph' as IconName }),
    );

    expect(html).toBe('');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    warn.mockRestore();
    error.mockRestore();
  });

  it('narrows known names and rejects unknown names via isIconName', () => {
    expect(isIconName('gem')).toBe(true);
    expect(isIconName('not-a-glyph')).toBe(false);
  });

  it('renders a ui-source icon', () => {
    const html = renderIcon({ name: 'chevron-down' });
    expect(html).toContain('<svg');
  });

  it('renders a game-source icon', () => {
    const html = renderIcon({ name: 'gem' });
    expect(html).toContain('<svg');
  });

  it('forwards data-* attributes to the rendered element', () => {
    const html = renderIcon({ name: 'chevron-down', 'data-accordion-icon': true });
    expect(html).toContain('data-accordion-icon="true"');
  });

  it('renders no user-facing literal text', () => {
    const html = renderIcon({ name: 'gem', label: 'Inventory gem' });
    expect(html).not.toMatch(/>[^<]+</);
  });
});
