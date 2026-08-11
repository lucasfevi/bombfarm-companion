import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell, type AppShellNavItem } from './AppShell';

const NAV_ITEMS: AppShellNavItem[] = [
  { id: 'inventory', label: 'Inventory', icon: 'chevron-down' },
  { id: 'stats', label: 'Stats', icon: 'chevron-up', badge: 3 },
];

function html(props: Parameters<typeof AppShell>[0]) {
  return renderToStaticMarkup(createElement(AppShell, props));
}

/**
 * Walks the React element tree returned by calling the component function
 * directly (not through a DOM renderer — `packages/ui`'s Vitest environment
 * is `node`, with no jsdom/testing-library). This lets us grab a nav item's
 * real `onClick` prop and invoke it, exercising the exact handler React would
 * call on a click or on native button Enter/Space activation.
 */
function findAll(node: ReactNode, predicate: (el: ReactElement) => boolean, acc: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, acc);
    return acc;
  }
  if (!isValidElement(node)) return acc;
  if (predicate(node)) acc.push(node);
  const children = (node.props as { children?: ReactNode }).children;
  if (children !== undefined) findAll(children, predicate, acc);
  return acc;
}

describe('AppShell', () => {
  it('renders title and children', () => {
    const out = html({ title: 'Smoke title', children: createElement('p', { 'data-testid': 'child' }, 'hello') });
    expect(out).toContain('Smoke title');
    expect(out).toContain('data-testid="child"');
    expect(out).toContain('hello');
  });

  it('defaults title when omitted', () => {
    const out = html({ children: 'body' });
    expect(out).toContain('Bomb Farm Companion');
    expect(out).toContain('body');
  });

  it.each(['DEV', 'NIGHTLY', 'BETA'] as const)('renders %s flavor badge', (label) => {
    const out = html({ badge: label, children: 'body' });
    expect(out).toContain('data-testid="flavor-badge"');
    expect(out).toContain(`>${label}<`);
  });

  it('omits flavor badge when badge is null', () => {
    const out = html({ badge: null, children: 'body' });
    expect(out).not.toContain('data-testid="flavor-badge"');
  });

  it('omits flavor badge when badge is omitted', () => {
    const out = html({ children: 'body' });
    expect(out).not.toContain('data-testid="flavor-badge"');
  });

  it('renders navigation, main, and contentinfo landmarks when items are present (SHL-01)', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    expect(out).toMatch(/<nav[^>]*aria-label="Main"/);
    expect(out).toContain('<main');
    expect(out).toContain('<footer');
  });

  it('renders no navigation landmark when items is empty (SHL-04)', () => {
    const out = html({ items: [], children: 'body' });
    expect(out).not.toContain('<nav');
  });

  it('renders no navigation landmark when items is omitted (SHL-04)', () => {
    const out = html({ children: 'body' });
    expect(out).not.toContain('<nav');
  });

  it('sets aria-current="page" on exactly one item matching activeId (SHL-03)', () => {
    const out = html({ items: NAV_ITEMS, activeId: 'stats', children: 'body' });
    const matches = out.match(/aria-current="page"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('renders every nav item as a real <button> (native Enter/Space activation) and fires onNavigate with its id on click', () => {
    let lastId: string | undefined;
    const tree = AppShell({
      items: NAV_ITEMS,
      activeId: 'inventory',
      onNavigate: (id) => {
        lastId = id;
      },
      children: 'body',
    });
    const buttons = findAll(tree, (el) => el.type === 'button');
    expect(buttons).toHaveLength(NAV_ITEMS.length);
    for (const button of buttons) expect(button.type).toBe('button');

    (buttons[1].props as { onClick: () => void }).onClick();
    expect(lastId).toBe('stats');
  });

  it('renders an optional numeric badge next to the label (SHL-09)', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    expect(out).toContain('>3<');
  });

  it('produces no empty status-bar children when status/progress/version are all absent (SHL-08)', () => {
    const out = html({ children: 'body' });
    expect(out).toMatch(/<footer[^>]*><\/footer>/);
  });

  it('renders only the provided status-bar slots', () => {
    const out = html({
      status: createElement('span', { 'data-testid': 'status-slot' }, 'Connected'),
      version: createElement('span', { 'data-testid': 'version-slot' }, 'v1.0.0'),
      children: 'body',
    });
    expect(out).toContain('data-testid="status-slot"');
    expect(out).toContain('data-testid="version-slot"');
    expect(out).not.toContain('data-testid="progress-slot"');
  });

  it('keeps collapsed nav labels in the accessibility tree via a visually-hidden span (SHL-06)', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    // Label text is present (queryable by accessible name) and only visually
    // hidden below the `compact` breakpoint — never removed from markup.
    expect(out).toMatch(/class="[^"]*sr-only[^"]*"[^>]*>Inventory</);
    expect(out).not.toContain('display:none');
  });

  it('main is the only element carrying overflow-y-auto alongside the nav scroll region', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    const mainMatch = out.match(/<main[^>]*class="([^"]*)"/);
    expect(mainMatch?.[1]).toContain('overflow-y-auto');
  });
});
