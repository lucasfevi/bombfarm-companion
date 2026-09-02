import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './button';
import { Num } from './num';
import { Select } from './select';
import { Slider } from './slider';
import { Switch } from './switch';
import { stackFieldsClass } from './panel-field.recipe';
import { SaveBar, SettingsRow, SettingsSection } from './settings-form';

function render<T extends (...args: never[]) => unknown>(component: T, props: Parameters<T>[0]) {
  return renderToStaticMarkup(createElement(component as never, props as never));
}

describe('SettingsSection — a titled region with an optional description', () => {
  it('renders the title as an h2 by default', () => {
    const html = render(SettingsSection, { title: 'Notifications', children: null });
    expect(html).toMatch(/<h2[^>]*>Notifications<\/h2>/);
  });

  it('renders the title at a caller-supplied heading level', () => {
    const html = render(SettingsSection, { title: 'Notifications', headingLevel: 3, children: null });
    expect(html).toMatch(/<h3[^>]*>Notifications<\/h3>/);
    expect(html).not.toContain('<h2');
  });

  it('renders an optional description', () => {
    const html = render(SettingsSection, {
      title: 'Notifications',
      description: 'Control toast auto-dismiss and sound.',
      children: null,
    });
    expect(html).toContain('Control toast auto-dismiss and sound.');
  });

  it('omits the description paragraph when absent', () => {
    const html = render(SettingsSection, { title: 'Notifications', children: null });
    expect(html).not.toContain('<p');
  });

  it('renders its children in the body', () => {
    const html = render(SettingsSection, {
      title: 'Notifications',
      children: createElement('p', null, 'row content'),
    });
    expect(html).toContain('row content');
  });
});

describe('SettingsRow — composes Fields', () => {
  it('renders the label text', () => {
    const html = render(SettingsRow, { label: 'Auto-dismiss', children: null });
    expect(html).toContain('Auto-dismiss');
  });

  it('renders optional help text tagged data-field-hint', () => {
    const html = render(SettingsRow, {
      label: 'Auto-dismiss',
      help: 'Applies to success and info toasts only.',
      children: null,
    });
    // `stackFieldsClass` always embeds the `[data-field-hint]` selector string in its own class
    // attribute, so assert the actual rendered element attribute, not a loose substring.
    expect(html).toContain('<span data-field-hint');
    expect(html).toContain('Applies to success and info toasts only.');
  });

  it('omits the hint span when help is absent', () => {
    const html = render(SettingsRow, { label: 'Auto-dismiss', children: null });
    expect(html).not.toContain('<span data-field-hint');
  });

  it('renders the control slot inside the row', () => {
    const html = render(SettingsRow, {
      label: 'Auto-dismiss',
      children: createElement('input', { type: 'checkbox', 'data-testid': 'control' }),
    });
    expect(html).toContain('data-testid="control"');
  });

  it('wraps content in a <label> inside Fields grid classes (composition, not a hand-rolled grid)', () => {
    const html = render(SettingsRow, { label: 'Auto-dismiss', children: null });
    expect(html).toMatch(/<div class="[^"]*grid[^"]*"><label>/);
  });

  it('forwards layout to Fields (defaults to stack)', () => {
    const stacked = render(SettingsRow, { label: 'Auto-dismiss', children: null });
    const inline = render(SettingsRow, { label: 'Auto-dismiss', layout: 'inline', children: null });
    expect(stacked).not.toEqual(inline);
  });
});

describe('SaveBar — dirty/saving states with Save and Discard', () => {
  it('disables both actions when not dirty', () => {
    const html = render(SaveBar, { dirty: false, onSave: () => {}, onDiscard: () => {} });
    // `(?<!-)` excludes base-ui's own `data-disabled=""` state attribute, counting only the native `disabled=""`.
    expect((html.match(/(?<!-)disabled=""/g) ?? []).length).toBe(2);
  });

  it('enables both actions when dirty and not saving', () => {
    const html = render(SaveBar, { dirty: true, onSave: () => {}, onDiscard: () => {} });
    expect(html).not.toContain('disabled=""');
  });

  it('shows a busy state and disables actions while saving', () => {
    const html = render(SaveBar, { dirty: true, saving: true, onSave: () => {}, onDiscard: () => {} });
    expect(html).toContain('aria-busy="true"');
    // `(?<!-)` excludes base-ui's own `data-disabled=""` state attribute, counting only the native `disabled=""`.
    expect((html.match(/(?<!-)disabled=""/g) ?? []).length).toBe(2);
    expect(html).toContain('Saving…');
  });

  it('renders the default Save/Discard labels, overridable by props', () => {
    const defaults = render(SaveBar, { dirty: true, onSave: () => {}, onDiscard: () => {} });
    expect(defaults).toContain('Save');
    expect(defaults).toContain('Discard');

    const custom = render(SaveBar, {
      dirty: true,
      onSave: () => {},
      onDiscard: () => {},
      saveLabel: 'Salvar',
      discardLabel: 'Descartar',
    });
    expect(custom).toContain('Salvar');
    expect(custom).toContain('Descartar');
  });

  it('exposes dirty/saving as data attributes for state-driven styling', () => {
    const clean = render(SaveBar, { dirty: false, onSave: () => {}, onDiscard: () => {} });
    expect(clean).not.toContain('data-dirty');

    const dirty = render(SaveBar, { dirty: true, onSave: () => {}, onDiscard: () => {} });
    expect(dirty).toContain('data-dirty="true"');

    const saving = render(SaveBar, { dirty: true, saving: true, onSave: () => {}, onDiscard: () => {} });
    expect(saving).toContain('data-saving="true"');
  });
});

/**
 * The stack grid puts `label > span` in the label cell, so a control whose own root element is a
 * `<span>` is caught by that rule and draws on top of the label instead of claiming column 2 —
 * silently, because the markup is right and only the grid placement is wrong. Every control
 * primitive a row can hold is checked against the markers the recipe actually carries, so the
 * next span-rooted primitive fails here rather than in a screenshot.
 */
describe('SettingsRow — no control primitive lands in the label cell', () => {
  const columnTwoMarkers = [
    ...stackFieldsClass.matchAll(/\[&_label_\[(data-[a-z-]+)\]\]:col-start-2/g),
  ].map((match) => match[1]);

  function controlRootOf(control: ReactElement) {
    const html = renderToStaticMarkup(
      createElement(SettingsRow, { label: 'Row label', help: 'Row help', children: control } as never),
    );
    const labelStart = html.indexOf('<label>') + '<label>'.length;
    let cursor = labelStart;
    let depth = 0;
    do {
      if (html.startsWith('</span>', cursor)) depth -= 1;
      else if (html.startsWith('<span', cursor)) depth += 1;
      cursor += 1;
    } while (depth > 0 || cursor === labelStart + 1);
    const controlMarkup = html.slice(html.indexOf('>', cursor - 1) + 1);
    const [, tag, attributes] = /^<([a-z]+)([^>]*)>/.exec(controlMarkup) ?? [];
    return { tag, attributes: attributes ?? '' };
  }

  it.each([
    ['Switch', createElement(Switch, { checked: false, 'aria-label': 'Row label' })],
    ['Num', createElement(Num, { value: 1, onChange: () => {} })],
    ['Select', createElement(Select, { value: 'a', onChange: () => {} }, createElement('option', { value: 'a' }, 'A'))],
    ['Button', createElement(Button, { type: 'button' }, 'Act')],
    ['Slider', createElement(Slider, { value: 1, onValueChange: () => {}, 'aria-label': 'Row label' })],
  ])('%s claims the control column', (_name, control) => {
    const { tag, attributes } = controlRootOf(control as ReactElement);
    // Never let a parse miss pass as a pass: an unread root reports no tag, not a safe one.
    expect(tag).toMatch(/^[a-z]+$/);
    if (tag !== 'span') return;
    expect(columnTwoMarkers.some((marker) => attributes.includes(marker))).toBe(true);
  });

  it('red state demonstrated: a bare <span> control has no marker and would draw on the label', () => {
    const { tag, attributes } = controlRootOf(createElement('span', null, 'v1.2.3'));
    expect(tag).toBe('span');
    expect(columnTwoMarkers.some((marker) => attributes.includes(marker))).toBe(false);
  });
});
