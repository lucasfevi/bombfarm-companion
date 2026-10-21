// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppNav, type AppNavItem } from './app-nav';
import { mountDom, type DomMount } from './dom-test-harness';

const COMPACT_ITEMS: AppNavItem[] = [
  { id: 'planner', label: 'Planner', active: true },
  { id: 'farm', label: 'Farm', active: false, icon: 'cog' },
  { id: 'live', label: 'Live', active: false, mark: { tone: 'up', label: 'Connected', detail: 'Ping 12 ms' } },
];

const withoutGeneratedIds = (html: string | undefined) => html?.replace(/ id="base-ui-[^"]*"/g, '');

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('AppNav tooltip loading', () => {
  let mount: DomMount | undefined;

  afterEach(() => {
    mount?.unmount();
    mount = undefined;
  });

  it('renders the same item markup on its first synchronous render as once the tooltip has loaded', async () => {
    mount = mountDom();
    mount.render(createElement(AppNav, { items: COMPACT_ITEMS, compact: true }));
    const navAtFirstRender = withoutGeneratedIds(mount.container.querySelector('nav')?.outerHTML);
    expect(navAtFirstRender).toContain('aria-label="Farm"');
    expect(navAtFirstRender).toContain('data-testid="nav-mark-live"');

    await act(async () => {
      await import('./app-nav-tooltip-items');
      await nextTick();
    });

    expect(withoutGeneratedIds(mount.container.querySelector('nav')?.outerHTML)).toBe(navAtFirstRender);
  });

  it('shows a marked item tooltip once the tooltip has loaded', async () => {
    mount = mountDom();
    mount.render(createElement(AppNav, { items: COMPACT_ITEMS, compact: true }));
    await act(async () => {
      await import('./app-nav-tooltip-items');
      await nextTick();
    });

    const trigger = mount.container.querySelector<HTMLElement>('[data-mark="up"]');
    await act(async () => {
      trigger?.focus();
      await nextTick();
    });

    expect(document.body.querySelector('[data-testid="nav-mark-live-tip"]')?.textContent).toBe(
      'ConnectedPing 12 ms',
    );
  });
});
