// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { ConfirmDialog } from './confirm-dialog';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

type Handlers = {
  onConfirm: ReturnType<typeof vi.fn<() => void>>;
  onOpenChange: ReturnType<typeof vi.fn<(open: boolean) => void>>;
};

type OpenOptions = { description?: ReactNode; children?: ReactNode; size?: 'compact' | 'wide' };

/** The dialog is portalled out of the mount container, so everything is looked up on the body. */
function open(options: OpenOptions = { description: 'This cannot be undone.' }): Handlers {
  const handlers: Handlers = {
    onConfirm: vi.fn<() => void>(),
    onOpenChange: vi.fn<(open: boolean) => void>(),
  };
  dom.render(
    <ConfirmDialog
      open
      onOpenChange={handlers.onOpenChange}
      title="Delete hero"
      description={options.description}
      size={options.size}
      confirmLabel="Delete"
      cancelLabel="Keep"
      closeLabel="Close"
      onConfirm={handlers.onConfirm}
    >
      {options.children}
    </ConfirmDialog>,
  );
  return handlers;
}

function popup(): HTMLElement {
  const node = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!node) throw new Error('dialog popup is not rendered');
  return node;
}

function buttonLabelled(text: string): HTMLElement {
  const found = [...document.body.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent === text,
  );
  if (!found) throw new Error(`no button reading "${text}"`);
  return found;
}

function cornerClose(): HTMLElement {
  const node = document.body.querySelector<HTMLElement>('button[aria-label="Close"]');
  if (!node) throw new Error('no corner close labelled with the close label');
  return node;
}

function click(target: HTMLElement): void {
  dom.fire(target, new MouseEvent('click', { bubbles: true }));
}

/** Base UI passes its own event details alongside the flag; only the flag is ours. */
function openStates(spy: Handlers['onOpenChange']): boolean[] {
  return spy.mock.calls.map((call) => call[0]);
}

describe('ConfirmDialog', () => {
  it('runs the confirm action exactly once and then closes', () => {
    const { onConfirm, onOpenChange } = open();

    click(buttonLabelled('Delete'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(openStates(onOpenChange)).toEqual([false]);
  });

  it('closes on cancel without running the confirm action', () => {
    const { onConfirm, onOpenChange } = open();

    click(buttonLabelled('Keep'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(openStates(onOpenChange)).toEqual([false]);
  });

  it('treats Escape as cancel', () => {
    const { onConfirm, onOpenChange } = open();

    dom.fire(popup(), new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(openStates(onOpenChange)).toEqual([false]);
  });

  it('treats the corner close as cancel, and gives it a name of its own', () => {
    const { onConfirm, onOpenChange } = open();

    const close = cornerClose();
    expect(close).not.toBe(buttonLabelled('Keep'));
    expect(document.body.querySelectorAll('button[aria-label="Keep"]')).toHaveLength(0);

    click(close);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(openStates(onOpenChange)).toEqual([false]);
  });

  it('renders the title and description it was given', () => {
    open();

    expect(popup().textContent).toContain('Delete hero');
    expect(popup().textContent).toContain('This cannot be undone.');
  });

  describe('with a body', () => {
    const body = (
      <>
        <ul data-testid="body-list">
          <li>Sword</li>
        </ul>
        <section data-testid="body-callout">Gone for good</section>
      </>
    );

    it('renders block content below the description, in a div rather than the description paragraph', () => {
      open({ description: 'Short copy.', children: body });

      const list = popup().querySelector('[data-testid="body-list"]');
      expect(list?.closest('p')).toBeNull();
      expect(list?.parentElement?.tagName).toBe('DIV');
      const description = [...popup().querySelectorAll('p')].find((node) => node.textContent === 'Short copy.');
      expect(description?.compareDocumentPosition(list as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('keeps the actions below the body and still confirms exactly once', () => {
      const { onConfirm } = open({ children: body });

      const callout = popup().querySelector('[data-testid="body-callout"]') as Node;
      expect(callout.compareDocumentPosition(buttonLabelled('Delete'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

      click(buttonLabelled('Delete'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('is described by the description when there is one', () => {
      open({ description: 'Short copy.', children: body });

      const described = popup().getAttribute('aria-describedby');
      expect(described).toBeTruthy();
      expect(document.getElementById(described as string)?.textContent).toBe('Short copy.');
    });

    it('is described by the body when there is no description', () => {
      open({ children: body });

      const described = document.getElementById(popup().getAttribute('aria-describedby') as string);
      expect(described?.querySelector('[data-testid="body-callout"]')).not.toBeNull();
    });

    it('leaves a plain confirm with no body element and no description link when it has neither', () => {
      open({});

      expect(popup().getAttribute('aria-describedby')).toBeNull();
      expect(popup().querySelector('.overflow-y-auto')).toBeNull();
    });

    it('widens only when asked, and bounds the popup to the window then', () => {
      open({ children: body, size: 'wide' });
      expect(popup().className).toContain('560px');
      expect(popup().className).toContain('100vh');
    });

    it('stays compact by default', () => {
      open({ children: body });
      expect(popup().className).toContain('420px');
      expect(popup().className).not.toContain('560px');
    });
  });
});
