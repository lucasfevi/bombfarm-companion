// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PremiumHostView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import type { PremiumProp } from '../../lib/premium/premium-bridge';
import { PremiumMount, type PremiumUiLoader } from './premium-mount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UI = 'app://bundle/_premium/7/ui/index.js';
const running: PremiumHostView = { phase: 'running', uiUrl: UI, styleUrl: null, localBuild: false };

let container: HTMLDivElement;
let root: Root;
let received: Record<string, unknown>[] = [];

function Probe(props: Record<string, unknown>) {
  received.push(props);
  return null;
}
const loader: PremiumUiLoader = () => Promise.resolve({ default: Probe as never });

beforeEach(() => {
  received = [];
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

async function render(host: PremiumHostView | null): Promise<void> {
  await act(async () => {
    root.render(createElement(CopyProvider, { locale: 'en', children: createElement(PremiumMount, { host, load: loader }) }));
    await Promise.resolve();
  });
}

describe('the prop the Premium screen is mounted with', () => {
  it('is exactly one prop, premium, with call and on', async () => {
    await render(running);

    expect(received.length).toBeGreaterThan(0);
    for (const props of received) {
      expect(Object.keys(props)).toEqual(['premium']);
      expect(Object.keys(props.premium as object).sort()).toEqual(['call', 'on']);
    }
  });

  it('sends a call over the capability channel and resolves with the value', async () => {
    const invoke = vi.fn(() => Promise.resolve({ id: 0, ok: true, value: 'answer' }));
    (window as unknown as { bfc: unknown }).bfc = { invoke };
    await render(running);

    const premium = received[0]?.premium as PremiumProp;
    await expect(premium.call('premium.status')).resolves.toBe('answer');
    expect(invoke).toHaveBeenCalledWith('premium:uiCall', 'premium.status', undefined);
  });

  it('keeps the same prop and its subscriptions while the host view changes', async () => {
    await render(running);
    const first = received[0]?.premium;
    const fn = vi.fn();
    (first as PremiumProp).on('paused', fn);

    await render({ ...running, styleUrl: null });
    expect(received.every((props) => props.premium === first)).toBe(true);

    await render({ phase: 'paused', uiUrl: null, styleUrl: null, localBuild: false, paused: { reason: 'unconfirmed' } });
    expect(fn).toHaveBeenCalledWith({ reason: 'unconfirmed' });
  });
});
