import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SegmentedToggle, type SegmentedToggleOption } from './segmented-toggle';

const OPTIONS: SegmentedToggleOption[] = [
  { id: 'pt', label: 'PT' },
  { id: 'en', label: 'EN' },
];

function html(props: Parameters<typeof SegmentedToggle>[0]) {
  return renderToStaticMarkup(createElement(SegmentedToggle, props));
}

describe('SegmentedToggle', () => {
  it('renders a labeled group of buttons, one per option, in order', () => {
    const out = html({ options: OPTIONS, value: 'pt', onChange: () => {}, ariaLabel: 'Language' });
    expect(out).toMatch(/role="group"[^>]*aria-label="Language"/);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>PT<\/button>.*<button[^>]*type="button"[^>]*>EN<\/button>/s);
  });

  it('renders exactly the selected option as active', () => {
    const out = html({ options: OPTIONS, value: 'en', onChange: () => {}, ariaLabel: 'Language' });
    expect(out).toMatch(/class="[^"]*\bbg-transparent\b[^"]*">PT</);
    expect(out).toMatch(/class="[^"]*\bbg-accent\b[^"]*text-accent-ink[^"]*">EN</);
  });

  it('fires onChange with the clicked option id', () => {
    let lastId: string | undefined;
    const tree = SegmentedToggle({
      options: OPTIONS,
      value: 'pt',
      onChange: (id) => {
        lastId = id;
      },
      ariaLabel: 'Language',
    });
    const buttons = (tree as { props: { children: unknown[] } }).props.children as Array<{
      props: { onClick: () => void };
    }>;
    buttons[1].props.onClick();
    expect(lastId).toBe('en');
  });
});
