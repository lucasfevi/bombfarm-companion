import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** React's `useId` counter is process-wide; number the ids by first appearance so they do not drift. */
function normaliseReactIds(html: string): string {
  const seen = new Map<string, string>();
  return html.replace(/:r[0-9a-z]+:|«r[0-9a-z]+»|_r_[0-9a-z]+_/g, (raw) => {
    let stable = seen.get(raw);
    if (!stable) {
      stable = `:id${seen.size + 1}:`;
      seen.set(raw, stable);
    }
    return stable;
  });
}

export function stubViewport(phone: boolean): void {
  window.matchMedia = (media: string) =>
    ({
      matches: phone && media.includes('max-width: 639px'),
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/** Renders into the document, lets lazy parts settle, and returns the body HTML one tag per line. */
export async function renderSettledShellHtml(node: ReactNode): Promise<string> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(node);
  });
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
  const html = normaliseReactIds(document.body.innerHTML).replace(/></g, '>\n<');
  act(() => {
    root.unmount();
  });
  host.remove();
  document.body.innerHTML = '';
  return html + '\n';
}
