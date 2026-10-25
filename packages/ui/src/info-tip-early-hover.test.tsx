// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDom, type DomMount } from './dom-test-harness';

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('InfoTip hovered before its tooltip has loaded', () => {
  let mount: DomMount | undefined;

  afterEach(() => {
    mount?.unmount();
    mount = undefined;
    vi.resetModules();
  });

  it('opens the tip as soon as the tooltip arrives', async () => {
    vi.resetModules();
    const { InfoTip } = await import('./info-tip');

    mount = mountDom();
    mount.render(createElement(InfoTip, { label: 'Scroll', tip: 'A miss keeps the level.' }));
    const pending = mount.container.querySelector<HTMLElement>('button');
    expect(pending?.id).toBe('');
    mount.fire(pending as HTMLElement, new MouseEvent('mouseover', { bubbles: true }));
    expect(document.body.querySelector('[data-slot="tooltip-popup"]')).toBeNull();

    await act(async () => {
      for (let round = 0; round < 40; round += 1) await nextTick();
    });

    expect(document.body.querySelector('[data-slot="tooltip-popup"]')?.textContent).toBe('A miss keeps the level.');
  });
});
