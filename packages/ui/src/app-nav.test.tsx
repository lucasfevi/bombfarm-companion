import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppNav, type AppNavItem } from './app-nav';

const ITEMS: AppNavItem[] = [
  { id: 'planner', label: 'Planner', active: true },
  { id: 'farm', label: 'Farm', active: false },
];

function html(props: Parameters<typeof AppNav>[0]) {
  return renderToStaticMarkup(createElement(AppNav, props));
}

describe('AppNav', () => {
  it('renders a nav landmark labeled "Main" by default', () => {
    const out = html({ items: ITEMS });
    expect(out).toMatch(/<nav[^>]*aria-label="Main"/);
  });

  it('accepts a caller-supplied aria-label', () => {
    const out = html({ items: ITEMS, ariaLabel: 'Main sections' });
    expect(out).toMatch(/<nav[^>]*aria-label="Main sections"/);
  });

  it('renders nothing when items is empty', () => {
    const out = html({ items: [] });
    expect(out).toBe('');
  });

  it('renders every item as a real <button> with its label as the only text', () => {
    const out = html({ items: ITEMS });
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Planner<\/button>/);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Farm<\/button>/);
  });

  it('sets aria-current="page" on exactly the active item', () => {
    const out = html({ items: ITEMS });
    const matches = out.match(/aria-current="page"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*>Planner</);
  });

  it('fires onSelect with the clicked item id', () => {
    let lastId: string | undefined;
    const tree = AppNav({
      items: ITEMS,
      onSelect: (id) => {
        lastId = id;
      },
    });
    const buttons = (tree as { props: { children: unknown[] } }).props.children as Array<{
      props: { onClick: () => void };
    }>;
    buttons[1].props.onClick();
    expect(lastId).toBe('farm');
  });

  it('defers to renderItem instead of rendering a <button> when provided', () => {
    const out = html({
      items: ITEMS,
      renderItem: (item, className) =>
        createElement('a', { key: item.id, href: `/${item.id}`, className }, item.label),
    });
    expect(out).not.toContain('<button');
    expect(out).toMatch(/<a[^>]*href="\/planner"[^>]*>Planner<\/a>/);
  });
});
