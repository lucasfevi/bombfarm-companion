import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusChip, type GameConnectionStatus } from './status-chip';

function render(props: Parameters<typeof StatusChip>[0]) {
  return renderToStaticMarkup(createElement(StatusChip, props));
}

/** Strips tags so we can assert the visible/announced text content only. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

describe('StatusChip', () => {
  it.each([
    ['connected', 'Connected'],
    ['not_running', 'Game not running'],
    ['stale', 'Stale'],
  ] as [GameConnectionStatus, string][])('renders the %s label text', (status, label) => {
    const html = render({ status, label });
    expect(html).toContain(label);
  });

  it('renders text exactly "Connected" when connected (smoke-test regression guard)', () => {
    const html = render({ status: 'connected', label: 'Connected' });
    expect(textOf(html)).toBe('Connected');
  });

  it('renders the age label when stale and ageLabel is provided', () => {
    const html = render({ status: 'stale', label: 'Stale', ageLabel: '3m' });
    expect(textOf(html)).toBe('Stale3m');
  });

  it('omits any age text when stale and ageLabel is absent', () => {
    const html = render({ status: 'stale', label: 'Stale' });
    expect(textOf(html)).toBe('Stale');
  });

  it('ignores ageLabel for non-stale statuses', () => {
    const html = render({ status: 'connected', label: 'Connected', ageLabel: '3m' });
    expect(textOf(html)).toBe('Connected');
  });

  it('renders role="status"', () => {
    const html = render({ status: 'connected', label: 'Connected' });
    expect(html).toContain('role="status"');
  });

  it('renders a decorative dot that contributes no text node', () => {
    const html = render({ status: 'connected', label: 'Connected' });
    expect(html).toContain('aria-hidden="true"');
    // The dot span must be empty — nothing between its own tags.
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><\/span>/);
  });

  it('rendered className contains no raw palette token', () => {
    const html = render({ status: 'stale', label: 'Stale', ageLabel: '3m' });
    expect(html).not.toMatch(/emerald|amber|slate|zinc/);
    expect(html).not.toMatch(/--bf-/);
  });

  it('forwards className', () => {
    const html = render({ status: 'connected', label: 'Connected', className: 'my-marker' });
    expect(html).toContain('my-marker');
  });
});
