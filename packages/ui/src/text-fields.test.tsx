// @vitest-environment happy-dom
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { TextArea } from './text-area';
import { TextInput } from './text-input';
import {
  fieldControlClass,
  fieldFocusVisibleClass,
  fieldInvalidClass,
  fieldPlaceholderClass,
  textFieldClass,
} from './panel-field.recipe';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

describe('field recipe keys', () => {
  it('leaves the existing control class byte-identical', () => {
    expect(fieldControlClass).toBe(
      'w-full rounded-sm border border-line bg-bg px-2 py-1.5 text-[13px] tabular-nums',
    );
  });

  it('names the focus ring, the placeholder colour and the invalid border', () => {
    expect(fieldFocusVisibleClass).toContain('focus-visible:ring-2');
    expect(fieldPlaceholderClass).toBe('placeholder:text-muted');
    expect(fieldInvalidClass).toContain('aria-invalid:border-down');
  });

  it('builds the text field chrome from the reference look plus the new keys', () => {
    const classes = textFieldClass.split(' ');
    for (const expected of [
      'w-full',
      'rounded-sm',
      'border',
      'border-line',
      'bg-bg-2',
      'px-3',
      'py-2',
      'text-sm',
      'text-ink',
      'focus:border-accent',
      'focus:outline-none',
      'placeholder:text-muted',
      'aria-invalid:border-down',
    ]) {
      expect(classes, expected).toContain(expected);
    }
    expect(classes.some((c) => c.startsWith('focus-visible:ring-'))).toBe(true);
  });
});

describe('TextInput', () => {
  it('renders an input with the field chrome and forwards native props', () => {
    const onChange = vi.fn();
    dom.render(
      <TextInput
        type="email"
        name="email"
        placeholder="you@example.com"
        maxLength={40}
        required
        data-testid="email"
        onChange={onChange}
      />,
    );
    const input = dom.container.querySelector('input');
    if (!input) throw new Error('no input rendered');
    expect(input.getAttribute('class')).toBe(textFieldClass);
    expect(input.type).toBe('email');
    expect(input.name).toBe('email');
    expect(input.placeholder).toBe('you@example.com');
    expect(input.maxLength).toBe(40);
    expect(input.required).toBe(true);
    expect(input.getAttribute('data-testid')).toBe('email');
  });

  it('lets a caller class win a conflicting utility', () => {
    dom.render(<TextInput className="px-1 w-auto" />);
    const classes = (dom.container.querySelector('input')?.getAttribute('class') ?? '').split(' ');
    expect(classes).toContain('px-1');
    expect(classes).toContain('w-auto');
    expect(classes).not.toContain('px-3');
    expect(classes).not.toContain('w-full');
  });

  it('forwards a ref to the input', () => {
    const ref = createRef<HTMLInputElement>();
    dom.render(<TextInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('marks the invalid state through aria-invalid', () => {
    dom.render(<TextInput aria-invalid />);
    expect(dom.container.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('renders on the server without hooks', () => {
    const html = renderToStaticMarkup(<TextInput defaultValue="abc" disabled />);
    expect(html).toContain('<input');
    expect(html).toContain('value="abc"');
    expect(html).toContain('disabled=""');
  });
});

describe('TextArea', () => {
  it('renders a textarea with the field chrome and forwards native props', () => {
    dom.render(<TextArea rows={5} name="body" placeholder="Say more" defaultValue="Draft" />);
    const area = dom.container.querySelector('textarea');
    if (!area) throw new Error('no textarea rendered');
    expect(area.getAttribute('class')).toBe(textFieldClass);
    expect(area.getAttribute('rows')).toBe('5');
    expect(area.name).toBe('body');
    expect(area.placeholder).toBe('Say more');
    expect(area.value).toBe('Draft');
  });

  it('forwards a ref and lets a caller class win', () => {
    const ref = createRef<HTMLTextAreaElement>();
    dom.render(<TextArea ref={ref} className="py-1" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    const classes = (ref.current?.getAttribute('class') ?? '').split(' ');
    expect(classes).toContain('py-1');
    expect(classes).not.toContain('py-2');
  });

  it('renders on the server without hooks', () => {
    const html = renderToStaticMarkup(<TextArea defaultValue="body text" />);
    expect(html).toMatch(/<textarea[^>]*>body text<\/textarea>/);
  });
});
