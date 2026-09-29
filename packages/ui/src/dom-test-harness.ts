// Test-only, so `tsconfig.json` excludes it and it never reaches `dist`.
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

// react-dom/client warns that act() is unsupported unless this is set — normally a testing
// library does it for you, and this repo has none.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type DomMount = {
  container: HTMLElement;
  render(node: ReactNode): void;
  /**
   * React 19 delegates listeners to the root container, so it only sees an event that bubbles
   * up to it: construct yours with `{ bubbles: true }`.
   */
  fire(target: Element, event: Event): void;
  unmount(): void;
};

export function mountDom(): DomMount {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    render(node) {
      act(() => {
        root.render(node);
      });
    },
    fire(target, event) {
      act(() => {
        target.dispatchEvent(event);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export function stubMatchMedia(matches = false): void {
  window.matchMedia = (media: string) => ({
    matches,
    media,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}
