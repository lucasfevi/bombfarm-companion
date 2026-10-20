// @vitest-environment happy-dom
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { NativeSelect } from './native-select';
import { textFieldClass } from './panel-field.recipe';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function selectNode(): HTMLSelectElement {
  const node = dom.container.querySelector('select');
  if (!node) throw new Error('no select rendered');
  return node;
}

describe('NativeSelect', () => {
  it('renders a native select with the field chrome and its options', () => {
    dom.render(
      <NativeSelect name="plan" defaultValue="b" aria-label="Plan">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    );
    const node = selectNode();
    expect(node.getAttribute('class')).toBe(textFieldClass);
    expect(node.name).toBe('plan');
    expect(node.value).toBe('b');
    expect([...node.options].map((option) => option.textContent)).toEqual(['Alpha', 'Beta']);
  });

  it('forwards native props, a ref and the invalid state', () => {
    const ref = createRef<HTMLSelectElement>();
    dom.render(
      <NativeSelect ref={ref} disabled required aria-invalid data-testid="plan">
        <option value="a">Alpha</option>
      </NativeSelect>,
    );
    const node = selectNode();
    expect(ref.current).toBe(node);
    expect(node.disabled).toBe(true);
    expect(node.required).toBe(true);
    expect(node.getAttribute('aria-invalid')).toBe('true');
    expect(node.getAttribute('data-testid')).toBe('plan');
  });

  it('lets a caller class win a conflicting utility', () => {
    dom.render(
      <NativeSelect className="w-auto py-1">
        <option>One</option>
      </NativeSelect>,
    );
    const classes = (selectNode().getAttribute('class') ?? '').split(' ');
    expect(classes).toContain('w-auto');
    expect(classes).toContain('py-1');
    expect(classes).not.toContain('w-full');
    expect(classes).not.toContain('py-2');
  });

  it('renders on the server without hooks', () => {
    const html = renderToStaticMarkup(
      <NativeSelect defaultValue="b">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    );
    expect(html).toContain('<select');
    expect(html).toMatch(/<option value="b" selected="">Beta<\/option>/);
  });
});
