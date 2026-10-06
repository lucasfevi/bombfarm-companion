// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from './checkbox';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function box(): HTMLElement {
  const node = dom.container.querySelector<HTMLElement>('[role="checkbox"]');
  if (!node) throw new Error('no checkbox rendered');
  return node;
}

function press(target: HTMLElement): void {
  dom.fire(target, new MouseEvent('click', { bubbles: true }));
}

describe('Checkbox', () => {
  it('is a labelled checkbox that reports the state it asks for', () => {
    dom.render(<Checkbox checked aria-label="Pick Iron Ring" onCheckedChange={() => {}} />);

    expect(box().getAttribute('aria-label')).toBe('Pick Iron Ring');
    expect(box().getAttribute('aria-checked')).toBe('true');
    expect(box().hasAttribute('data-checked')).toBe(true);
  });

  it('reports the next state when pressed and follows a controlling parent', () => {
    const seen = vi.fn();
    function Host() {
      const [on, setOn] = useState(false);
      return (
        <Checkbox
          aria-label="Pick"
          checked={on}
          onCheckedChange={(next) => {
            seen(next);
            setOn(next);
          }}
        />
      );
    }
    dom.render(<Host />);

    press(box());
    expect(seen).toHaveBeenLastCalledWith(true);
    expect(box().getAttribute('aria-checked')).toBe('true');

    press(box());
    expect(seen).toHaveBeenLastCalledWith(false);
    expect(box().getAttribute('aria-checked')).toBe('false');
  });

  it('is genuinely inert when disabled', () => {
    const onCheckedChange = vi.fn();
    dom.render(<Checkbox aria-label="Pick" disabled checked={false} onCheckedChange={onCheckedChange} />);

    press(box());

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(box().hasAttribute('data-disabled')).toBe(true);
    expect(dom.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
  });

  it('passes the description it is given through to the control', () => {
    dom.render(
      <>
        <Checkbox aria-label="Pick" aria-describedby="why" disabled checked={false} />
        <span id="why">Equipped by a hero</span>
      </>,
    );

    expect(box().getAttribute('aria-describedby')).toBe('why');
  });
});
