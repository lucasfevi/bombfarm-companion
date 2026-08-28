import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
