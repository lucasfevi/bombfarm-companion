// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CopyProvider } from '../lib/copy';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A tooltip mounts its popup only once open, and a hover is not something a DOM test can fake
// faithfully, so the root is held open to read what the popup says.
vi.mock('@bombfarm/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bombfarm/ui')>();
  const Root = (props: ComponentProps<typeof actual.Tooltip.Root>) =>
    createElement(actual.Tooltip.Root, { ...props, open: true });
  return { ...actual, Tooltip: { ...actual.Tooltip, Root } };
});

const { ShellActions } = await import('./shell-actions');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    await Promise.resolve();
  });
  container.remove();
});

describe('the Settings gear tooltip', () => {
  it.each([
    ['en', 'Settings'],
    ['pt-BR', 'Configurações'],
  ] as const)('names the gear in %s', async (locale, name) => {
    await act(async () => {
      root.render(
        createElement(CopyProvider, {
          locale,
          children: createElement(ShellActions, {
            density: 'full',
            granted: true,
            locale,
            onLocaleChange: () => {},
            settingsActive: false,
            onOpenSettings: () => {},
          }),
        }),
      );
      await Promise.resolve();
    });
    const popups = [...document.body.querySelectorAll('[data-open]')].map((node) => node.textContent);
    expect(popups).toContain(name);
  });
});
