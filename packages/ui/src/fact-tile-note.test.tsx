// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FactTile } from './fact-tile';
import { Tooltip } from './tooltip';
import { mountDom, type DomMount } from './dom-test-harness';

const withoutGeneratedIds = (html: string | undefined) => html?.replace(/ id="base-ui-[^"]*"/g, '');
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const tile = () =>
  createElement(
    Tooltip.Provider,
    null,
    createElement(FactTile, { label: 'Essence', value: '+1,200', note: 'Read from the forge.', 'data-testid': 'tile' }),
  );

describe('FactTile note loading', () => {
  let mount: DomMount | undefined;

  afterEach(() => {
    mount?.unmount();
    mount = undefined;
  });

  it('renders the same tile on its first synchronous render as once the tooltip has loaded', async () => {
    mount = mountDom();
    mount.render(tile());
    const atFirstRender = withoutGeneratedIds(mount.container.innerHTML);
    expect(atFirstRender).toContain('data-testid="tile"');

    await act(async () => {
      await import('./fact-tile-note');
      await nextTick();
    });

    expect(withoutGeneratedIds(mount.container.innerHTML)).toBe(atFirstRender);
  });
});
