// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { InfoTip } from './info-tip';
import { mountDom, type DomMount } from './dom-test-harness';

const withoutGeneratedIds = (html: string | undefined) => html?.replace(/ id="base-ui-[^"]*"/g, '');

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('InfoTip tooltip loading', () => {
  let mount: DomMount | undefined;

  afterEach(() => {
    mount?.unmount();
    mount = undefined;
  });

  it('renders the same trigger on its first synchronous render as once the tooltip has loaded', async () => {
    mount = mountDom();
    mount.render(createElement(InfoTip, { label: 'Scroll', tip: 'A miss keeps the level.', className: 'ml-1' }));
    const atFirstRender = withoutGeneratedIds(mount.container.innerHTML);
    expect(atFirstRender).toContain('aria-label="Scroll: A miss keeps the level."');

    await act(async () => {
      await import('./info-tip-tooltip');
      await nextTick();
    });

    expect(withoutGeneratedIds(mount.container.innerHTML)).toBe(atFirstRender);
  });

  it('shows the tip when the trigger takes keyboard focus once the tooltip has loaded', async () => {
    mount = mountDom();
    mount.render(createElement(InfoTip, { label: 'Scroll', tip: 'A miss keeps the level.' }));
    await act(async () => {
      await import('./info-tip-tooltip');
      await nextTick();
    });

    const trigger = mount.container.querySelector<HTMLElement>('button');
    await act(async () => {
      trigger?.focus();
      await nextTick();
    });

    expect(document.body.querySelector('[data-slot="tooltip-popup"]')?.textContent).toBe('A miss keeps the level.');
  });
});
