// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from '../dom-test-harness';
import { Tooltip } from './index';
import type { TooltipTriggerProps } from './types';

// The compile-time half of the contract. Drop the `Omit` in ./types.ts and `disabled` becomes
// assignable again, this directive goes unused, and `pnpm --filter @bombfarm/ui typecheck:tests`
// fails — which is the only thing that keeps the refusal from quietly disappearing.
// @ts-expect-error `disabled` is refused here: Base UI gives it a different meaning.
const disabledIsRefused: TooltipTriggerProps = { disabled: true };
void disabledIsRefused;

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function pressTarget(): HTMLButtonElement {
  const button = dom.container.querySelector('button');
  if (!button) throw new Error('no trigger button rendered');
  return button;
}

function press(button: HTMLButtonElement): void {
  dom.fire(button, new MouseEvent('click', { bubbles: true }));
}

describe('Tooltip.Trigger', () => {
  it('makes the control genuinely inert when disabled goes through render', () => {
    const onPress = vi.fn();
    dom.render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<button type="button" disabled onClick={onPress} />}>
          Refresh
        </Tooltip.Trigger>
      </Tooltip.Root>,
    );

    const button = pressTarget();
    expect(button.disabled).toBe(true);

    press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('leaves an aria-disabled control pressable, so its own handler is what refuses', () => {
    const onPress = vi.fn();
    const markup = (refusing: boolean) => (
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          aria-disabled={refusing}
          onClick={() => {
            if (refusing) return;
            onPress();
          }}
        >
          Refresh
        </Tooltip.Trigger>
      </Tooltip.Root>
    );

    dom.render(markup(true));
    const refusing = pressTarget();
    expect(refusing.getAttribute('aria-disabled')).toBe('true');
    expect(refusing.disabled).toBe(false);
    press(refusing);
    expect(onPress).not.toHaveBeenCalled();

    dom.render(markup(false));
    const accepting = pressTarget();
    expect(accepting.getAttribute('aria-disabled')).toBe('false');
    press(accepting);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
