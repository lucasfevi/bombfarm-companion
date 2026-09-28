// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { Num } from './num';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function field(): HTMLInputElement {
  const input = dom.container.querySelector<HTMLInputElement>('input[data-num-input]');
  if (!input) throw new Error('no numeric input rendered');
  return input;
}

function spinner(label: string): HTMLElement {
  const button = dom.container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!button) throw new Error(`no spinner labelled ${label}`);
  return button;
}

// React installs its own `value` descriptor on each controlled node and suppresses `onChange`
// when the node's value matches what that tracker last saw. Assigning `input.value` updates the
// tracker too, so the keystroke never reaches the component; the prototype's setter does not.
const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

function typeInto(input: HTMLInputElement, text: string): void {
  if (!setNativeValue) throw new Error('no native value setter to type through');
  setNativeValue.call(input, text);
  dom.fire(input, new Event('input', { bubbles: true }));
}

function blur(input: HTMLInputElement): void {
  dom.fire(input, new FocusEvent('focusout', { bubbles: true }));
}

describe('Num — committing what the user typed', () => {
  it('commits on every keystroke of a valid value', () => {
    const onChange = vi.fn();
    dom.render(<Num value={1} onChange={onChange} step={1} incrementLabel="up" decrementLabel="down" />);

    typeInto(field(), '12');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(12);

    typeInto(field(), '123');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(123);
  });

  it('commits nothing for an emptied field, so select-all-delete keeps the last good value', () => {
    const onChange = vi.fn();
    dom.render(<Num value={137} onChange={onChange} step={1} incrementLabel="up" decrementLabel="down" />);

    typeInto(field(), '');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits nothing for an entry no finite number can be read from', () => {
    const onChange = vi.fn();
    dom.render(<Num value={137} onChange={onChange} step={1} incrementLabel="up" decrementLabel="down" />);

    // A number field keeps this: it is a valid floating-point literal, it just overflows to
    // Infinity. `Number('1e400') > Number.MAX_VALUE`, so parsing alone does not reject it.
    typeInto(field(), '1e400');
    expect(field().value).toBe('1e400');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits nothing when there is no finite value to step from', () => {
    const onChange = vi.fn();
    dom.render(
      <Num
        value={Number.POSITIVE_INFINITY}
        onChange={onChange}
        step={1}
        incrementLabel="up"
        decrementLabel="down"
      />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    dom.fire(spinner('down'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the emptied field while the consumer keeps its value, and snaps back on blur', () => {
    const onChange = vi.fn();
    dom.render(<Num value={137} onChange={onChange} step={1} incrementLabel="up" decrementLabel="down" />);

    typeInto(field(), '');
    expect(field().value).toBe('');
    expect(onChange).not.toHaveBeenCalled();

    blur(field());
    expect(field().value).toBe('137');
  });
});

describe('Num — bounds', () => {
  it('clamps a typed value above max down to max', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={10} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    typeInto(field(), '9999');
    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it('clamps a typed value below min up to min', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={10} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    typeInto(field(), '-40');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('does not step past max', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={500} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it('does not step past min', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={0} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('down'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('leaves a value inside the bounds alone', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={10} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(11);
  });

  it('shows a value above max as max, rather than one its own bounds forbid', () => {
    dom.render(
      <Num value={9999} onChange={() => {}} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    expect(field().value).toBe('500');
  });

  it('shows a value below min as min', () => {
    dom.render(
      <Num value={-50} onChange={() => {}} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    expect(field().value).toBe('0');
  });

  it('steps down, not up, from a value above max', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={9999} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(500);

    dom.fire(spinner('down'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(499);
  });

  it('steps up, not down, from a value below min', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={-50} onChange={onChange} step={1} min={0} max={500} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('down'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(0);

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('keeps min authoritative when the bounds cross', () => {
    const onChange = vi.fn();
    dom.render(<Num value={7} onChange={onChange} min={10} max={5} incrementLabel="up" decrementLabel="down" />);

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('reflects a spinner step in the field even when a draft is showing', () => {
    const onChange = vi.fn();
    dom.render(<Num value={4} onChange={onChange} step={1} incrementLabel="up" decrementLabel="down" />);

    typeInto(field(), '');
    expect(field().value).toBe('');

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(field().value).toBe('4');
  });
});

describe('Num — decimals', () => {
  it('rounds a committed value to the requested fraction digits', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={1} onChange={onChange} step={0.1} decimals={2} incrementLabel="up" decrementLabel="down" />,
    );

    typeInto(field(), '1.23456');
    expect(onChange).toHaveBeenLastCalledWith(1.23);
  });

  it('displays the prop value rounded to the requested fraction digits', () => {
    dom.render(
      <Num value={1.23456} onChange={() => {}} step={0.1} decimals={2} incrementLabel="up" decrementLabel="down" />,
    );

    expect(field().value).toBe('1.23');
  });

  it('rounds a stepped value rather than carrying float noise', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={0.7} onChange={onChange} step={0.1} decimals={2} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(0.8);
  });

  it('honours the fraction-digit promise even against a bound finer than it', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={1} onChange={onChange} step={0.1} decimals={2} max={1.005} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));

    const committed = onChange.mock.calls.at(-1)?.[0] as number;
    expect(committed).toBeLessThanOrEqual(1.005);
    expect(committed).toBe(Number(committed.toFixed(2)));
  });

  it('never commits above a max that rounding would carry upwards', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={1.2} onChange={onChange} step={0.1} decimals={1} max={1.25} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('up'), new MouseEvent('click', { bubbles: true }));

    expect(onChange.mock.calls.at(-1)?.[0]).toBeLessThanOrEqual(1.25);
  });

  it('never commits below a min that rounding would carry downwards', () => {
    const onChange = vi.fn();
    dom.render(
      <Num value={1.3} onChange={onChange} step={0.1} decimals={1} min={1.24} incrementLabel="up" decrementLabel="down" />,
    );

    dom.fire(spinner('down'), new MouseEvent('click', { bubbles: true }));

    expect(onChange.mock.calls.at(-1)?.[0]).toBeGreaterThanOrEqual(1.24);
  });
});

describe('Num — the draft and the outside world', () => {
  /** A parent that owns the value, so the field can be driven from somewhere other than itself. */
  function renderHost(props?: { min?: number; max?: number }) {
    function Host() {
      const [value, setValue] = useState(137);
      return (
        <>
          <button type="button" data-reset onClick={() => setValue(42)}>
            reset
          </button>
          <Num
            value={value}
            onChange={setValue}
            step={1}
            min={props?.min}
            max={props?.max}
            incrementLabel="up"
            decrementLabel="down"
          />
        </>
      );
    }
    dom.render(<Host />);
  }

  function reset(): void {
    const button = dom.container.querySelector<HTMLElement>('[data-reset]');
    if (!button) throw new Error('no reset button rendered');
    dom.fire(button, new MouseEvent('click', { bubbles: true }));
  }

  it('drops a half-typed entry when the value changes from outside', () => {
    renderHost();

    typeInto(field(), '');
    expect(field().value).toBe('');

    reset();
    expect(field().value).toBe('42');
  });

  it('keeps a half-typed entry when the value coming back is the one it asked for', () => {
    renderHost({ min: 0, max: 500 });

    typeInto(field(), '9999');
    expect(field().value).toBe('9999');

    blur(field());
    expect(field().value).toBe('500');
  });
});
