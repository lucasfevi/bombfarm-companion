// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CopyProvider } from '../lib/copy';
import { ScreenBoundary } from './screen-boundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Crashes(): never {
  throw new Error('boom');
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
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

function renderBoundary(boundary: ReactElement): void {
  act(() => {
    root.render(<CopyProvider locale="en">{boundary}</CopyProvider>);
  });
}

describe('ScreenBoundary reports a crash through the bridge', () => {
  it('sends one log:rendererError record naming the screen, with the message, the stack and the component stack', () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    (window as unknown as { bfc: unknown }).bfc = { invoke };

    renderBoundary(
      <ScreenBoundary screen="heroes">
        <Crashes />
      </ScreenBoundary>,
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    const [channel, record] = invoke.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(channel).toBe('log:rendererError');
    expect(Object.keys(record).sort()).toEqual(['componentStack', 'event', 'message', 'screen', 'stack']);
    expect(record).toMatchObject({ event: 'screen.crash', screen: 'heroes', message: 'boom' });
    expect(record.stack).toContain('boom');
    expect(record.componentStack).toContain('Crashes');
    expect(container.querySelector('[data-testid="screen-crash"]')).not.toBeNull();
  });

  it('still shows the fallback when the bridge refuses the call', async () => {
    const invoke = vi.fn(() => Promise.reject(new Error('IPC sender not permitted')));
    (window as unknown as { bfc: unknown }).bfc = { invoke };

    renderBoundary(
      <ScreenBoundary screen="forge">
        <Crashes />
      </ScreenBoundary>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="screen-crash"]')).not.toBeNull();
  });

  it('still shows the fallback when there is no bridge at all', () => {
    renderBoundary(
      <ScreenBoundary screen="forge">
        <Crashes />
      </ScreenBoundary>,
    );

    expect(container.querySelector('[data-testid="screen-crash"]')).not.toBeNull();
  });

  it('draws a fallback of the caller own when given one, and still reports', () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    (window as unknown as { bfc: unknown }).bfc = { invoke };

    renderBoundary(
      <ScreenBoundary screen="mini-live" fallback={() => <p data-testid="own-fallback">own</p>}>
        <Crashes />
      </ScreenBoundary>,
    );

    expect(container.querySelector('[data-testid="own-fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="screen-crash"]')).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('reports nothing while the children render', () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    (window as unknown as { bfc: unknown }).bfc = { invoke };

    renderBoundary(
      <ScreenBoundary screen="heroes">
        <p data-testid="fine">fine</p>
      </ScreenBoundary>,
    );

    expect(invoke).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fine"]')).not.toBeNull();
  });
});
