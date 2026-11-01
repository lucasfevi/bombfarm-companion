// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PremiumHostView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { PremiumMount, type PremiumUiLoader } from './premium-mount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UI = 'app://bundle/_premium/7/ui/index.js';
const CSS = 'app://bundle/_premium/7/ui/index.css';

function host(rest: Partial<PremiumHostView> = {}): PremiumHostView {
  return { phase: 'none', uiUrl: null, styleUrl: null, localBuild: false, ...rest };
}
const running = (rest: Partial<PremiumHostView> = {}) => host({ phase: 'running', uiUrl: UI, styleUrl: CSS, ...rest });

function Marker() {
  return createElement('span', { 'data-testid': 'ui-marker' }, 'marker-text');
}
const goodLoader: PremiumUiLoader = () => Promise.resolve({ default: Marker });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.head.querySelectorAll('link').forEach((link) => {
    link.remove();
  });
  vi.restoreAllMocks();
});

async function render(
  view: PremiumHostView | null,
  props: { load?: PremiumUiLoader; onMountFailed?: () => void; locale?: 'en' | 'pt-BR' } = {},
): Promise<void> {
  const { locale = 'en', ...rest } = props;
  const element: ReactElement = createElement(PremiumMount, { host: view, ...rest });
  await act(async () => {
    root.render(createElement(CopyProvider, { locale, children: element }));
    await Promise.resolve();
  });
}

const byId = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const sheets = () => [...document.head.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));

describe('the Premium mount point', () => {
  it('renders nothing without a host view or a bundle', async () => {
    await render(null);
    expect(container.innerHTML).toBe('');
    await render(host());
    expect(container.innerHTML).toBe('');
  });

  it('imports and mounts the bundle UI only when running with an address', async () => {
    const load = vi.fn(goodLoader);
    await render(host({ phase: 'updating' }), { load });
    await render(host({ phase: 'paused', uiUrl: UI, styleUrl: CSS }), { load });
    await render(host({ phase: 'running' }), { load });
    expect(load).not.toHaveBeenCalled();
    expect(byId('premium-host-mount')).toBeNull();

    await render(running(), { load });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(UI);
    expect(byId('premium-host-mount')?.textContent).toBe('marker-text');
  });

  it('attaches the stylesheet on mount and removes it when the UI goes', async () => {
    await render(running(), { load: goodLoader });
    expect(sheets()).toEqual([CSS]);

    await render(host({ phase: 'paused' }), { load: goodLoader });
    expect(sheets()).toEqual([]);
    expect(byId('premium-host-mount')).toBeNull();

    await render(running(), { load: goodLoader });
    expect(sheets()).toEqual([CSS]);

    act(() => {
      root.unmount();
    });
    expect(sheets()).toEqual([]);
    root = createRoot(container);
  });

  it('publishes the shared modules before importing the bundle', async () => {
    let seen: unknown;
    const load: PremiumUiLoader = () => {
      seen = (globalThis as Record<string, unknown>).__bfcPremiumShared;
      return Promise.resolve({ default: Marker });
    };
    await render(running(), { load });
    expect(Object.keys(seen as object)).toEqual([
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react/compiler-runtime',
      '@bombfarm/ui',
    ]);
  });

  it.each([
    ['en', en],
    ['pt-BR', ptBR],
  ] as const)('says what is happening in %s', async (locale, copy) => {
    await render(host({ phase: 'updating' }), { locale });
    expect(byId('premium-host-updating')?.textContent).toBe(copy.premiumHostUpdating);

    await render(host({ phase: 'stopped' }), { locale });
    expect(byId('premium-host-stopped')?.textContent).toBe(copy.premiumHostStopped);
    expect(byId('premium-host-updating')).toBeNull();

    await render(host({ phase: 'paused' }), { locale });
    expect(container.innerHTML).toBe('');

    await render(host({ phase: 'running', localBuild: true }), { locale });
    expect(byId('premium-host-local')?.textContent).toBe(copy.premiumHostLocalBuild);
    expect(byId('premium-host-local-hint')?.textContent).toBe(copy.premiumHostLocalBuildHint);
    expect(byId('premium-host-mount')).toBeNull();
  });

  it('shows the local build badge, without the hint, once the local bundle is mounted', async () => {
    await render(running({ localBuild: true }), { load: goodLoader });
    expect(byId('premium-host-local')).not.toBeNull();
    expect(byId('premium-host-local-hint')).toBeNull();
    expect(byId('premium-host-mount')?.textContent).toBe('marker-text');
  });

  it('reports a failed import once and shows the stopped line', async () => {
    const onMountFailed = vi.fn();
    const load: PremiumUiLoader = () => Promise.reject(new Error('no module'));
    await render(running(), { load, onMountFailed });
    expect(onMountFailed).toHaveBeenCalledTimes(1);
    expect(byId('premium-host-stopped')?.textContent).toBe(en.premiumHostStopped);
    expect(byId('premium-host-mount')).toBeNull();

    await render(running(), { load, onMountFailed });
    expect(onMountFailed).toHaveBeenCalledTimes(1);
  });

  it('reports a render error once and shows the stopped line', async () => {
    const onMountFailed = vi.fn();
    const Broken = (): never => {
      throw new Error('render');
    };
    await render(running(), { load: () => Promise.resolve({ default: Broken }), onMountFailed });
    expect(onMountFailed).toHaveBeenCalledTimes(1);
    expect(byId('premium-host-stopped')?.textContent).toBe(en.premiumHostStopped);
    expect(sheets()).toEqual([]);
  });

  it('by default tells main through the bridge', async () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    (window as unknown as { bfc: unknown }).bfc = { invoke };
    try {
      await render(running(), { load: () => Promise.reject(new Error('x')) });
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith('premium:hostMountFailed');
    } finally {
      delete (window as { bfc?: unknown }).bfc;
    }
  });
});
