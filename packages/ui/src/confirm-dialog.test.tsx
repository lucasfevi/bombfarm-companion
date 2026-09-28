// @vitest-environment happy-dom
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

/** The dialog is portalled out of the mount container, so everything is looked up on the body. */
function open(): Handlers {
  const handlers: Handlers = {
    onConfirm: vi.fn<() => void>(),
    onOpenChange: vi.fn<(open: boolean) => void>(),
  };
  dom.render(
    <ConfirmDialog
      open
      onOpenChange={handlers.onOpenChange}
      title="Delete hero"
      description="This cannot be undone."
      confirmLabel="Delete"
      cancelLabel="Keep"
      onConfirm={handlers.onConfirm}
    />,
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
  const node = document.body.querySelector<HTMLElement>('button[aria-label="Keep"]');
  if (!node) throw new Error('no corner close labelled with the cancel label');
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

  it('treats the corner close as cancel, and names it with the cancel label', () => {
    const { onConfirm, onOpenChange } = open();

    const close = cornerClose();
    expect(close).not.toBe(buttonLabelled('Keep'));

    click(close);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(openStates(onOpenChange)).toEqual([false]);
  });

  it('renders the title and description it was given', () => {
    open();

    expect(popup().textContent).toContain('Delete hero');
    expect(popup().textContent).toContain('This cannot be undone.');
  });
});
