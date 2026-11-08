// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PremiumHostView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { PremiumMount, type PremiumUiLoader } from './premium-mount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UI = 'app://bundle/_premium/7/ui/index.js';
const view = (rest: Partial<PremiumHostView> = {}): PremiumHostView => ({
  phase: 'running',
  uiUrl: UI,
  styleUrl: null,
  localBuild: false,
  slots: ['premium.tab', 'live.section'],
  ...rest,
});

let container: HTMLDivElement;
let root: Root;
let received: Record<string, unknown>[] = [];

function Probe(props: Record<string, unknown>) {
  received.push(props);
  return createElement('span', { 'data-testid': 'ui-marker' });
}
const loader: PremiumUiLoader = () => Promise.resolve({ default: Probe as never });

beforeEach(() => {
  received = [];
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
  delete (window as { bfc?: unknown }).bfc;
  vi.restoreAllMocks();
});

async function render(
  host: PremiumHostView | null,
  props: { load?: PremiumUiLoader; slot?: 'live.section' | 'premium.tab' } = {},
) {
  await act(async () => {
    root.render(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(PremiumMount, { host, load: loader, slot: 'live.section', ...props }),
      }),
    );
    await Promise.resolve();
  });
}

describe('PremiumMount in the live.section slot', () => {
  it('gives the root exactly one prop, whose slot is live.section', async () => {
    await render(view());
    expect(received.length).toBeGreaterThan(0);
    for (const props of received) {
      expect(Object.keys(props)).toEqual(['premium']);
      expect((props.premium as { slot: string }).slot).toBe('live.section');
    }
  });

  it('gives the Premium tab root the premium.tab slot', async () => {
    await render(view(), { slot: 'premium.tab' });
    expect((received[0]?.premium as { slot: string }).slot).toBe('premium.tab');
  });

  it.each([
    ['not running (updating)', view({ phase: 'updating' })],
    ['paused', view({ phase: 'paused' })],
    ['stopped', view({ phase: 'stopped' })],
    ['no host', null],
    ['not granted', view({ slots: ['premium.tab'] })],
    ['slots absent', { ...view(), slots: undefined } as unknown as PremiumHostView],
    ['a running host with no UI', view({ uiUrl: null })],
    ['a local build waiting for its UI', view({ uiUrl: null, localBuild: true })],
  ])('renders nothing at all when %s', async (_name, host) => {
    await render(host);
    expect(container.innerHTML).toBe('');
    expect(received).toEqual([]);
  });

  it('hides a throwing section, tells only the section channel, and keeps its siblings', async () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    (window as unknown as { bfc: unknown }).bfc = { invoke };
    function Broken(): never {
      throw new Error('boom');
    }
    await act(async () => {
      root.render(
        createElement(CopyProvider, {
          locale: 'en',
          children: createElement(
            'div',
            null,
            createElement('p', { 'data-testid': 'sibling' }, 'rest of the tab'),
            createElement(PremiumMount, { host: view(), slot: 'live.section', load: () => Promise.resolve({ default: Broken }) }),
          ),
        }),
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="sibling"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="premium-live-section"]')).toBeNull();
    expect(container.querySelector('[data-testid="premium-host-stopped"]')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('premium:sectionMountFailed');
    expect(invoke).not.toHaveBeenCalledWith('premium:hostMountFailed');
  });

  it('hides the section when its import fails, without stopping the host', async () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    (window as unknown as { bfc: unknown }).bfc = { invoke };
    await render(view(), { load: () => Promise.reject(new Error('gone')) });

    expect(container.innerHTML).toBe('');
    expect(invoke).toHaveBeenCalledWith('premium:sectionMountFailed');
    expect(invoke).not.toHaveBeenCalledWith('premium:hostMountFailed');
  });
});
