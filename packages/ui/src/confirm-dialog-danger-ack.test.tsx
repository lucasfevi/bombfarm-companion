// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function dialog(overrides: Partial<ConfirmDialogProps> = {}) {
  const props: ConfirmDialogProps = {
    open: true,
    onOpenChange: vi.fn<(open: boolean) => void>(),
    title: 'Delete account',
    description: 'This cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep',
    closeLabel: 'Close',
    onConfirm: vi.fn<() => void>(),
    ...overrides,
  };
  return <ConfirmDialog {...props} />;
}

function buttonLabelled(text: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === text,
  );
  if (!found) throw new Error(`no button reading "${text}"`);
  return found;
}

function ackBox(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[type="checkbox"]');
}

function click(target: HTMLElement): void {
  dom.fire(target, new MouseEvent('click', { bubbles: true }));
}

describe('ConfirmDialog tone danger', () => {
  it('dresses the confirm button in the solid danger recipe', () => {
    dom.render(dialog({ tone: 'danger' }));
    const classes = buttonLabelled('Delete').className.split(' ');
    expect(classes).toContain('border-down');
    expect(classes).toContain('bg-down');
    expect(classes).toContain('text-accent-ink');
    expect(classes).not.toContain('bg-accent');
  });

  it('leaves the confirm button on the accent recipe when unset', () => {
    dom.render(dialog());
    const classes = buttonLabelled('Delete').className.split(' ');
    expect(classes).toContain('bg-accent');
    expect(classes).not.toContain('bg-down');
  });

  it('renders no acknowledgement checkbox when unset', () => {
    dom.render(dialog({ tone: 'danger' }));
    expect(ackBox()).toBeNull();
    expect(buttonLabelled('Delete').disabled).toBe(false);
  });
});

describe('ConfirmDialog requireAck', () => {
  it('renders an unticked labelled checkbox and disables confirm', () => {
    dom.render(dialog({ requireAck: 'I understand this is permanent' }));
    const box = ackBox();
    expect(box).not.toBeNull();
    expect(box?.checked).toBe(false);
    expect(box?.closest('label')?.textContent).toContain('I understand this is permanent');
    expect(buttonLabelled('Delete').disabled).toBe(true);
  });

  it('enables confirm once ticked and disables it again when unticked', () => {
    dom.render(dialog({ requireAck: 'I understand' }));
    click(ackBox() as HTMLElement);
    expect(ackBox()?.checked).toBe(true);
    expect(buttonLabelled('Delete').disabled).toBe(false);
    click(ackBox() as HTMLElement);
    expect(buttonLabelled('Delete').disabled).toBe(true);
  });

  it('does not run the confirm action while unticked', () => {
    const onConfirm = vi.fn<() => void>();
    dom.render(dialog({ requireAck: 'I understand', onConfirm }));
    click(buttonLabelled('Delete'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms once after ticking', () => {
    const onConfirm = vi.fn<() => void>();
    dom.render(dialog({ requireAck: 'I understand', onConfirm }));
    click(ackBox() as HTMLElement);
    click(buttonLabelled('Delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('puts initial focus on the checkbox', async () => {
    dom.render(dialog({ requireAck: 'I understand' }));
    await vi.waitFor(() => expect(document.activeElement).toBe(ackBox()));
  });

  describe('is unticked again after the dialog closes and reopens', () => {
    function tickThenReopen(close: () => void): void {
      dom.render(dialog({ requireAck: 'I understand' }));
      click(ackBox() as HTMLElement);
      expect(ackBox()?.checked).toBe(true);
      close();
      dom.render(dialog({ requireAck: 'I understand', open: false }));
      expect(ackBox()).toBeNull();
      dom.render(dialog({ requireAck: 'I understand', open: true }));
    }

    function expectReset(): void {
      expect(ackBox()?.checked).toBe(false);
      expect(buttonLabelled('Delete').disabled).toBe(true);
    }

    it('after cancel', () => {
      tickThenReopen(() => click(buttonLabelled('Keep')));
      expectReset();
    });

    it('after confirm', () => {
      tickThenReopen(() => click(buttonLabelled('Delete')));
      expectReset();
    });

    it('after Escape', () => {
      tickThenReopen(() => {
        const popup = document.body.querySelector('[role="dialog"]') as HTMLElement;
        dom.fire(popup, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expectReset();
    });

    it('after the controlled open prop goes false', () => {
      tickThenReopen(() => undefined);
      expectReset();
    });
  });
});
