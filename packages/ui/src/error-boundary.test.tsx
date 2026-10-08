// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, type DomMount } from './dom-test-harness';
import { ErrorBoundary } from './error-boundary';

let dom: DomMount;
let broken = true;

function Flaky() {
  if (broken) throw new Error('bad read');
  return <p data-testid="child">fine</p>;
}

function tree(resetKey: string, onError = vi.fn()) {
  return (
    <div>
      <p data-testid="sibling">nav</p>
      <ErrorBoundary
        resetKey={resetKey}
        onError={onError}
        fallback={(retry) => (
          <button type="button" data-testid="retry" onClick={retry}>
            again
          </button>
        )}
      >
        <Flaky />
      </ErrorBoundary>
    </div>
  );
}

const q = (id: string) => dom.container.querySelector(`[data-testid="${id}"]`);

beforeEach(() => {
  broken = true;
  dom = mountDom();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  dom.unmount();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows the fallback for a throwing child and leaves the sibling alone', () => {
    dom.render(tree('a'));
    expect(q('retry')).not.toBeNull();
    expect(q('child')).toBeNull();
    expect(q('sibling')?.textContent).toBe('nav');
  });

  it('reports the error with its component stack', () => {
    const onError = vi.fn();
    dom.render(tree('a', onError));
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info] = onError.mock.calls[0] as [Error, { componentStack: string }];
    expect(error.message).toBe('bad read');
    expect(info.componentStack).toContain('Flaky');
  });

  it('renders the child again on retry once it stops throwing', () => {
    dom.render(tree('a'));
    broken = false;
    dom.fire(q('retry')!, new MouseEvent('click', { bubbles: true }));
    expect(q('child')?.textContent).toBe('fine');
    expect(q('retry')).toBeNull();
  });

  it('retries when the reset key changes', () => {
    dom.render(tree('a'));
    broken = false;
    dom.render(tree('b'));
    expect(q('child')).not.toBeNull();
  });

  it('keeps the fallback while the reset key is unchanged', () => {
    dom.render(tree('a'));
    broken = false;
    dom.render(tree('a'));
    expect(q('retry')).not.toBeNull();
  });
});
