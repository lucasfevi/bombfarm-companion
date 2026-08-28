import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell, type AppShellNavItem } from './AppShell';

const NAV_ITEMS: AppShellNavItem[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'stats', label: 'Stats' },
];

function html(props: Parameters<typeof AppShell>[0]) {
  return renderToStaticMarkup(createElement(AppShell, props));
}

/**
 * Walks the React element tree returned by calling the component function directly (not through a
 * DOM renderer — `packages/ui`'s Vitest environment is `node`, with no jsdom/testing-library).
 * `AppShell`'s nav buttons live one function-component hop away now (inside `AppNav`), so a node
 * whose `type` is itself a function is resolved by calling it — the same thing React would do —
 * before continuing the walk. This still lets a test grab a nav item's real `onClick` prop and
 * invoke it, exercising the exact handler React would call on a click or on native button
 * Enter/Space activation.
 */
function findAll(node: ReactNode, predicate: (el: ReactElement) => boolean, acc: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, acc);
    return acc;
  }
  if (!isValidElement(node)) return acc;
  if (predicate(node)) acc.push(node);
  if (typeof node.type === 'function') {
    const rendered = (node.type as (props: unknown) => ReactNode)(node.props);
    findAll(rendered, predicate, acc);
    return acc;
  }
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

  it('renders navigation, main, and contentinfo landmarks when items are present', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    expect(out).toMatch(/<nav[^>]*aria-label="Main"/);
    expect(out).toContain('<main');
    expect(out).toContain('<footer');
  });

  it('renders no navigation landmark when items is empty', () => {
    const out = html({ items: [], children: 'body' });
    expect(out).not.toContain('<nav');
  });

  it('renders no navigation landmark when items is omitted', () => {
    const out = html({ children: 'body' });
    expect(out).not.toContain('<nav');
  });

  it('sets aria-current="page" on exactly one item matching activeId', () => {
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

  it('renders each nav button with only its label as text — no icon, no badge', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    expect(out).toMatch(/<button[^>]*>Inventory<\/button>/);
    expect(out).toMatch(/<button[^>]*>Stats<\/button>/);
  });

  it('renders the actions slot on the right of the header when provided', () => {
    const out = html({
      actions: createElement('span', { 'data-testid': 'actions-slot' }, 'PT/EN'),
      children: 'body',
    });
    expect(out).toContain('data-testid="actions-slot"');
  });

  it('omits the actions wrapper entirely when actions is not provided', () => {
    const out = html({ children: 'body' });
    expect(out).not.toContain('data-testid="actions-slot"');
  });

  it('produces no empty status-bar children when status/progress/version are all absent', () => {
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

  it('main is the only scroll region — the header and status bar never scroll', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    const mainMatch = out.match(/<main[^>]*class="([^"]*)"/);
    expect(mainMatch?.[1]).toContain('overflow-y-auto');
    const headerMatch = out.match(/<header[^>]*class="([^"]*)"/);
    const footerMatch = out.match(/<footer[^>]*class="([^"]*)"/);
    expect(headerMatch?.[1]).not.toContain('overflow-y-auto');
    expect(footerMatch?.[1]).not.toContain('overflow-y-auto');
  });

  it('applies no drag styling by default', () => {
    const out = html({ items: NAV_ITEMS, children: 'body' });
    expect(out).not.toContain('app-region');
  });

  it('draws the drag handle as one empty rectangle, and never marks the header itself', () => {
    const out = html({ items: NAV_ITEMS, draggable: true, children: 'body' });
    const headerMatch = out.match(/<header[^>]*style="([^"]*)"/);
    expect(headerMatch?.[1] ?? '').not.toMatch(/-webkit-app-region/);
    expect(out.match(/-webkit-app-region:\s*drag/g) ?? []).toHaveLength(1);
    expect(out).toMatch(/<div aria-hidden="true"[^>]*style="[^"]*-webkit-app-region:\s*drag[^"]*"><\/div>/);
  });

  it('excuses every region that takes a click from the drag handle', () => {
    // Painting above the handle does not exclude anything from it: the region is built from the
    // property alone. A control left unmarked is a control the window manager presses instead.
    const out = html({
      items: NAV_ITEMS,
      draggable: true,
      actions: createElement('span', null, 'PT/EN'),
      children: 'body',
    });
    // Brand row, nav wrapper, actions wrapper.
    expect(out.match(/-webkit-app-region:\s*no-drag/g) ?? []).toHaveLength(3);
  });

  it('marks nothing at all when the shell is not the title bar', () => {
    const out = html({ items: NAV_ITEMS, actions: createElement('span', null, 'PT/EN'), children: 'body' });
    expect(out).not.toContain('app-region');
  });

  it('stops the drag handle short of the room reserved for the OS caption buttons', () => {
    const out = html({ items: NAV_ITEMS, draggable: true, overlayInset: 140, children: 'body' });
    const stripMatch = out.match(/<div aria-hidden="true"[^>]*style="([^"]*)"><\/div>/);
    expect(stripMatch?.[1]).toMatch(/right:\s*140px/);
    expect(stripMatch?.[1]).toMatch(/-webkit-app-region:\s*drag/);
  });

  it('reserves overlayInset as right padding on the header', () => {
    const out = html({ items: NAV_ITEMS, overlayInset: 140, children: 'body' });
    const headerMatch = out.match(/<header[^>]*style="([^"]*)"/);
    expect(headerMatch?.[1]).toMatch(/padding-right:\s*140px/);
  });

  it('renders the brand slot left of the title when provided', () => {
    const out = html({
      brand: createElement('span', { 'data-testid': 'brand-slot' }, 'mark'),
      children: 'body',
    });
    expect(out).toContain('data-testid="brand-slot"');
    expect(out.indexOf('data-testid="brand-slot"')).toBeLessThan(out.indexOf('Bomb Farm Companion'));
  });

  it('renders no brand slot markup when brand is omitted', () => {
    const out = html({ children: 'body' });
    expect(out).not.toContain('data-testid="brand-slot"');
  });
});
