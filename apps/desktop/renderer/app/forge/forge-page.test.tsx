// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EMPTY_FORGE_HISTORY, type AccountView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { rawGear } from '../../lib/deconstruct/test-items';
import { setForgePage } from '../../lib/forge/forge-page-store';
import { resetScreenRefreshForTests, screenRefreshOf } from '../../lib/refresh/screen-refresh-store';
import { ForgePage } from './forge-page';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEW = {
  payload: { items: [rawGear({ id: '1' })], heroes: [], account: { gold: 10, essence: 20 } },
  gameRunning: true,
  store: { status: 'ok', reason: null, binding: null },
} as unknown as AccountView;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (window as unknown as { bfc: unknown }).bfc = {
    invoke: (channel: string) => {
      if (channel === 'account:get') return Promise.resolve(VIEW);
      if (channel === 'forge:history') return Promise.resolve(EMPTY_FORGE_HISTORY);
      return Promise.resolve(undefined);
    },
    on: () => () => undefined,
  };
});

beforeEach(async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <CopyProvider locale="en">
        <ForgePage forgeWritesEnabled accountSource="server" />
      </CopyProvider>,
    );
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    setForgePage('forge');
    await Promise.resolve();
  });
  container.remove();
  resetScreenRefreshForTests();
});

function tabs(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="tab"]')];
}

function tabNamed(name: string): HTMLElement {
  const found = tabs().find((tab) => tab.textContent.trim() === name);
  if (!found) throw new Error(`no tab named ${name}`);
  return found;
}

async function press(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('the Forge | Deconstruct switch', () => {
  it('offers the two pages as tabs, not buttons, so a lookup of the nav button named Forge never lands on the switch', () => {
    expect(tabs().map((tab) => tab.textContent.trim())).toEqual([en.forgeNavLabel, en.deconstructNavLabel]);
    const list = container.querySelector('[role="tablist"]');
    const asButtons = [...(list?.querySelectorAll('button') ?? [])].filter((button) => button.getAttribute('role') !== 'tab');
    expect(asButtons).toEqual([]);
  });

  it('opens on the forge page with the existing Forge screen under it, untouched', () => {
    expect(tabNamed('Forge').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-testid="forge-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="forge-toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="deconstruct-view"]')).toBeNull();
  });

  it('swaps to the Deconstruct page and back, rendering only one of the two at a time', async () => {
    await press(tabNamed('Deconstruct'));
    expect(tabNamed('Deconstruct').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-testid="deconstruct-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="forge-view"]')).toBeNull();

    await press(tabNamed('Forge'));
    expect(container.querySelector('[data-testid="forge-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="deconstruct-view"]')).toBeNull();
  });

  it('remembers the page for the window, so leaving the Forge tab and coming back reopens it', async () => {
    await press(tabNamed('Deconstruct'));
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <CopyProvider locale="en">
          <ForgePage forgeWritesEnabled accountSource="server" />
        </CopyProvider>,
      );
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="forge-page"]')?.getAttribute('data-page')).toBe('deconstruct');
    expect(container.querySelector('[data-testid="deconstruct-view"]')).not.toBeNull();
  });

  it('keeps one refresh registration under the Forge tab through every swap', async () => {
    expect(screenRefreshOf('forge')).not.toBeNull();
    await press(tabNamed('Deconstruct'));
    expect(screenRefreshOf('forge')).not.toBeNull();
    await press(tabNamed('Forge'));
    expect(screenRefreshOf('forge')).not.toBeNull();
  });

  it('is the same height on both pages, so a swap moves nothing under the bar', async () => {
    const bar = () => container.querySelector('[role="tablist"]')?.className;
    const before = bar();
    await press(tabNamed('Deconstruct'));
    expect(bar()).toBe(before);
  });
});
