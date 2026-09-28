// @vitest-environment happy-dom
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

  it('commits nothing for a lone minus sign, which a number field reports as an empty value', () => {
    const onChange = vi.fn();
    dom.render(<Num value={137} onChange={onChange} step={1} incrementLabel="up" decrementLabel="down" />);

    typeInto(field(), '-');
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
});
