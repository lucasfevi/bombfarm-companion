// @vitest-environment happy-dom
import { Profiler, useState, type ChangeEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { Select } from './select';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function trigger(): HTMLElement {
  const node = dom.container.querySelector<HTMLElement>('[data-select]');
  if (!node) throw new Error('no select trigger rendered');
  return node;
}

/** The popup is portalled out of the mount container, so it is only ever found on the body. */
function options(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
}

function optionNamed(text: string): HTMLElement {
  const found = options().find((option) => option.textContent === text);
  if (!found) throw new Error(`no option "${text}" among ${options().map((o) => o.textContent)}`);
  return found;
}

function listbox(): HTMLElement {
  const node = document.body.querySelector<HTMLElement>('[role="listbox"]');
  if (!node) throw new Error('popup is not open');
  return node;
}

function highlighted(): HTMLElement {
  const found = options().find((option) => option.hasAttribute('data-highlighted'));
  if (!found) throw new Error('no option is highlighted');
  return found;
}

function press(target: Element, key: string): void {
  dom.fire(target, new KeyboardEvent('keydown', { key, bubbles: true }));
}

function committedValues(spy: { mock: { calls: [ChangeEvent<HTMLSelectElement>][] } }): string[] {
  return spy.mock.calls.map((call) => call[0].target.value);
}

describe('Select — the option list is handed back under one identity', () => {
  /**
   * Base UI republishes `items` into its own store from a layout effect keyed on that array's
   * identity, so a fresh array each render buys a second commit for every render of the panel the
   * Select sits in. Counting the subtree's commits is how that identity becomes visible from
   * outside the component: with the cache, a parent re-render that leaves the options alone is one
   * commit; without it, the republish adds a nested one.
   */
  it('costs one commit for a parent re-render that changes nothing about the options', () => {
    const commits: string[] = [];

    function Host() {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button type="button" data-bump onClick={() => setTick((n) => n + 1)}>
            {tick}
          </button>
          <Profiler id="select" onRender={(_id, phase) => commits.push(phase)}>
            <Select value="a" onChange={() => {}} aria-label="pick">
              <option value="a">Alpha</option>
              <option value="b">Beta</option>
            </Select>
          </Profiler>
        </>
      );
    }

    dom.render(<Host />);
    const bump = dom.container.querySelector<HTMLElement>('[data-bump]');
    if (!bump) throw new Error('no re-render trigger rendered');

    commits.length = 0;
    dom.fire(bump, new MouseEvent('click', { bubbles: true }));

    expect(commits).toEqual(['update']);
  });
});

describe('Select — the identity changes as soon as an option does', () => {
  it('follows a relabelled option through to the trigger', () => {
    const markup = (label: string) => (
      <Select value="a" onChange={() => {}} aria-label="pick">
        <option value="a">{label}</option>
        <option value="b">Beta</option>
      </Select>
    );

    dom.render(markup('Alpha'));
    expect(trigger().textContent).toBe('Alpha');

    dom.render(markup('Alpha Prime'));
    expect(trigger().textContent).toBe('Alpha Prime');
  });

  it('follows a revalued option, so the trigger still resolves the selection', () => {
    const markup = (selected: string) => (
      <Select value={selected} onChange={() => {}} aria-label="pick">
        <option value={selected}>Alpha</option>
        <option value="b">Beta</option>
      </Select>
    );

    dom.render(markup('a'));
    expect(trigger().textContent).toBe('Alpha');

    dom.render(markup('a-renamed'));
    expect(trigger().textContent).toBe('Alpha');
  });

  it('follows a newly disabled option into the open popup', () => {
    const markup = (locked: boolean) => (
      <Select value="a" onChange={() => {}} aria-label="pick">
        <option value="a">Alpha</option>
        <option value="b" disabled={locked}>
          Beta
        </option>
      </Select>
    );

    dom.render(markup(false));
    press(trigger(), 'ArrowDown');
    expect(optionNamed('Beta').getAttribute('aria-disabled')).toBe(null);

    dom.render(markup(true));
    expect(optionNamed('Beta').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Select — the synthesised change event', () => {
  it('reports the chosen value on a keyboard pick', () => {
    const onChange = vi.fn<(event: ChangeEvent<HTMLSelectElement>) => void>();
    dom.render(
      <Select value="a" onChange={onChange} aria-label="pick">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
        <option value="c">Gamma</option>
      </Select>,
    );

    press(trigger(), 'ArrowDown');
    expect(highlighted().textContent).toBe('Alpha');

    press(listbox(), 'ArrowDown');
    expect(highlighted().textContent).toBe('Beta');

    press(highlighted(), 'Enter');

    expect(committedValues(onChange)).toEqual(['b']);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('carries the chosen value on currentTarget as well, since consumers read either', () => {
    const onChange = vi.fn<(event: ChangeEvent<HTMLSelectElement>) => void>();
    dom.render(
      <Select value="a" onChange={onChange} aria-label="pick">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );

    press(trigger(), 'ArrowDown');
    press(listbox(), 'ArrowDown');
    press(highlighted(), 'Enter');

    expect(onChange.mock.calls[0][0].currentTarget.value).toBe('b');
  });
});
