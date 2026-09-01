/**
 * Tests the control-is-a-primitive rule (the control is a `@bombfarm/ui` primitive) and the
 * not-persisted warning's surface half. Both locales rendered via `renderToStaticMarkup` (node
 * env, no jsdom); red state demonstrated for the ignored-`persisted` mutation.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { WindowSection } from './window-section';

describe('WindowSection source — zero bespoke controls of its own (docs/base-ui-first.md)', () => {
  const source = readFileSync(join(__dirname, 'window-section.tsx'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('no <select>, <input>, <button> or <label> element literal', () => {
    expect(/<(select|input|button|label)\b/.test(stripped)).toBe(false);
  });

  it('red state demonstrated: a fixture with a bare <button> element is caught', () => {
    expect(/<(select|input|button|label)\b/.test('<button type="button">x</button>')).toBe(true);
  });
});

describe('WindowSection renders SettingsSection -> SettingsRow -> Switch, both locales', () => {
  it("the always-on-top label differs between an English-language UI and a PT-BR-language UI", () => {
    const underEnglishUi = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(WindowSection, {
          alwaysOnTopMain: false,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: null,
        }),
      }),
    );
    const underPtBrUi = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(WindowSection, {
          alwaysOnTopMain: false,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: null,
        }),
      }),
    );
    expect(underEnglishUi).toContain('Keep the main window on top');
    expect(underPtBrUi).toContain('Manter a janela principal no topo');
    expect(underEnglishUi).not.toContain('Manter a janela principal no topo');
  });

  it('English: aria-label and switch role both come from copy', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(WindowSection, {
          alwaysOnTopMain: false,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: null,
        }),
      }),
    );
    expect(html).toContain('aria-label="Keep the main window on top"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
  });

  it('PT-BR: aria-label differs from English', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(WindowSection, {
          alwaysOnTopMain: true,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: null,
        }),
      }),
    );
    expect(html).toContain('aria-label="Manter a janela principal no topo"');
    expect(html).not.toContain('aria-label="Keep the main window on top"');
    expect(html).toContain('aria-checked="true"');
  });
});

describe('WindowSection — the not-persisted Banner is an always-mounted slot (docs/no-layout-shift.md rule 1)', () => {
  it('persisted (persistWarning: null): the slot is present, empty, and hidden', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(WindowSection, {
          alwaysOnTopMain: false,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: null,
        }),
      }),
    );
    expect(html).toContain('data-testid="settings-always-on-top-warning"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('Your save location');
    expect(html).not.toContain('could not be saved');
    expect(html).not.toContain('data-testid="settings-language-warning"');
  });

  it("not persisted (persistWarning: 'not_writable'): the reason renders and the slot is visible", () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(WindowSection, {
          alwaysOnTopMain: true,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: 'not_writable',
        }),
      }),
    );
    expect(html).toContain('data-testid="settings-always-on-top-warning"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Always-on-top changed, but not saved');
    expect(html).toContain('Your save location is not writable');
    expect(html).not.toContain('data-testid="settings-language-warning"');
  });

  it("not persisted (persistWarning: 'no_store'), PT-BR: the PT-BR reason renders", () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(WindowSection, {
          alwaysOnTopMain: true,
          onAlwaysOnTopMainChange: () => {},
          persistWarning: 'no_store',
        }),
      }),
    );
    expect(html).toContain('indisponível');
    expect(html).not.toContain('data-testid="settings-language-warning"');
  });
});
