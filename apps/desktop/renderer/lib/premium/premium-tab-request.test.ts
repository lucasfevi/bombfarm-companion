// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePremiumTabRequest } from './premium-tab-request';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ open }: { open: () => void }) {
  usePremiumTabRequest(open);
  return null;
}

let container: HTMLDivElement;
let root: Root;
const handlers = new Map<string, () => void>();
const unsubscribe = vi.fn();

beforeEach(() => {
  handlers.clear();
  unsubscribe.mockReset();
  (window as unknown as { bfc: unknown }).bfc = {
    on: (channel: string, handler: () => void) => {
      handlers.set(channel, handler);
      return unsubscribe;
    },
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  delete (window as { bfc?: unknown }).bfc;
  container.remove();
});

describe('a request from main to show the Premium tab', () => {
  it('opens the tab each time main sends it', () => {
    const open = vi.fn();
    act(() => {
      root.render(createElement(Probe, { open }));
    });

    handlers.get('premium:showTab')?.();
    handlers.get('premium:showTab')?.();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('stops listening when the window unmounts', () => {
    act(() => {
      root.render(createElement(Probe, { open: vi.fn() }));
    });
    act(() => {
      root.unmount();
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does nothing where there is no bridge', () => {
    delete (window as { bfc?: unknown }).bfc;
    expect(() => {
      act(() => {
        root.render(createElement(Probe, { open: vi.fn() }));
      });
    }).not.toThrow();
  });
});
