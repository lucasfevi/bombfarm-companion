import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationCenter, type NotificationCenterItem } from './notification-center';

function render(props: Parameters<typeof NotificationCenter>[0]) {
  return renderToStaticMarkup(createElement(NotificationCenter, props));
}

const sampleItems: NotificationCenterItem[] = [
  { id: '1', variant: 'success', title: 'Price pass complete', timeLabel: '2m ago' },
  { id: '2', variant: 'error', title: 'Connection lost', description: 'Game closed unexpectedly.', timeLabel: '5m ago' },
];

describe('NotificationCenter — TST-19 fully controlled', () => {
  it('renders exactly the given items', () => {
    const html = render({ items: sampleItems, onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect(html).toContain('Price pass complete');
    expect(html).toContain('Connection lost');
  });

  it('renders a clear-all control only when onClearAll is provided', () => {
    const withClear = render({
      items: sampleItems,
      onDismiss: () => {},
      onClearAll: () => {},
      emptyLabel: 'No notifications yet',
    });
    expect(withClear).toContain('Clear all');

    const withoutClear = render({ items: sampleItems, onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect(withoutClear).not.toContain('Clear all');
  });

  it('accepts a custom emptyLabel and clearAllLabel', () => {
    const html = render({
      items: sampleItems,
      onDismiss: () => {},
      onClearAll: () => {},
      emptyLabel: 'Nothing here',
      clearAllLabel: 'Limpar tudo',
    });
    expect(html).toContain('Limpar tudo');
  });
});

describe('NotificationCenter — TST-20 row content', () => {
  it('renders title, description, and the preformatted timeLabel', () => {
    const html = render({ items: sampleItems, onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect(html).toContain('Connection lost');
    expect(html).toContain('Game closed unexpectedly.');
    expect(html).toContain('5m ago');
  });

  it('omits the description paragraph when absent', () => {
    const html = render({
      items: [{ id: '1', variant: 'info', title: 'Update available', timeLabel: 'just now' }],
      onDismiss: () => {},
      emptyLabel: 'No notifications yet',
    });
    // Title paragraph exists, but no second <p> for description. (`\b` excludes SVG `<path>`.)
    expect((html.match(/<p\b/g) ?? []).length).toBe(1);
  });

  it('renders a variant icon per row', () => {
    const html = render({ items: sampleItems, onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    // One decorative icon per row plus one dismiss-button icon per row = 2 per row.
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(sampleItems.length);
  });
});

describe('NotificationCenter — TST-21 empty state', () => {
  it('renders EmptyState (an h2 title) when items is empty', () => {
    const html = render({ items: [], onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect(html).toMatch(/<h2[^>]*>No notifications yet<\/h2>/);
  });

  it('renders no list markup when empty', () => {
    const html = render({ items: [], onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect(html).not.toContain('<ul');
  });
});

describe('NotificationCenter — TST-22 bounded scroll container', () => {
  it('the list container has an internal scroll + max-height, not unbounded growth', () => {
    const html = render({ items: sampleItems, onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect(html).toContain('overflow-y-auto');
    expect(html).toMatch(/max-h-\d/);
  });

  it('renders all 50 buffered rows inside the same bounded container (no pagination DOM growth)', () => {
    const many: NotificationCenterItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `n${i}`,
      variant: 'info',
      title: `Notification ${i}`,
      timeLabel: `${i}m ago`,
    }));
    const html = render({ items: many, onDismiss: () => {}, emptyLabel: 'No notifications yet' });
    expect((html.match(/<li/g) ?? []).length).toBe(50);
    expect((html.match(/<ul/g) ?? []).length).toBe(1);
  });
});

describe('NotificationCenter — onDismiss id plumbing', () => {
  it('renders one dismiss button per row with the caller-supplied label', () => {
    const html = render({
      items: sampleItems,
      onDismiss: () => {},
      emptyLabel: 'No notifications yet',
      dismissLabel: 'Remove',
    });
    expect((html.match(/aria-label="Remove"/g) ?? []).length).toBe(sampleItems.length);
  });

  /** Walks the pre-render React element tree (plain `{ type, props }` objects) — no DOM needed. */
  function collectByAriaLabel(node: unknown, label: string, out: { props: Record<string, unknown> }[] = []) {
    if (node === null || node === undefined || typeof node === 'boolean' || typeof node === 'string') return out;
    if (Array.isArray(node)) {
      for (const child of node) collectByAriaLabel(child, label, out);
      return out;
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const el = node as { props: Record<string, unknown> };
      if (el.props?.['aria-label'] === label) out.push(el);
      collectByAriaLabel(el.props?.children, label, out);
    }
    return out;
  }

  it('calls onDismiss with the id of the row whose dismiss button was activated', () => {
    const dismissed: string[] = [];
    const element = NotificationCenter({
      items: sampleItems,
      onDismiss: (id: string) => dismissed.push(id),
      emptyLabel: 'No notifications yet',
    });
    const buttons = collectByAriaLabel(element, 'Dismiss');
    expect(buttons.length).toBe(sampleItems.length);

    (buttons[1].props.onClick as () => void)();
    expect(dismissed).toEqual(['2']);

    (buttons[0].props.onClick as () => void)();
    expect(dismissed).toEqual(['2', '1']);
  });
});
