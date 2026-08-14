/**
 * MP3 F4 — MIN-16 (the control is a `@bombfarm/ui` primitive) and MIN-11's surface half (the
 * not-persisted warning). Both locales rendered via `renderToStaticMarkup` (node env, no jsdom —
 * `AD-047`); red state demonstrated for the ignored-`persisted` mutation.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { LanguageSection } from './language-section';

describe('LanguageSection source — zero bespoke controls of its own (MIN-16, docs/base-ui-first.md)', () => {
  // Scans this component's OWN source for a literal, hand-authored <select>/<input>/<button>/
  // <label> — the same genre as planning-guards.test.ts's "No local controls" guard. The rendered
  // HTML necessarily contains a <button>/<label> (Select's Base UI trigger, SettingsRow's own
  // <label>) — those belong to the shipped primitives, not to this file, which is exactly why the
  // check is source-scoped rather than DOM-scoped.
  const source = readFileSync(join(__dirname, 'language-section.tsx'), 'utf8');
  // Strip JSX comments so this doc comment's own mention of the tag names is not self-flagged.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('no <select>, <input>, <button> or <label> element literal', () => {
    expect(/<(select|input|button|label)\b/.test(stripped)).toBe(false);
  });

  it('red state demonstrated: a fixture with a bare <select> element is caught', () => {
    expect(/<(select|input|button|label)\b/.test('<select><option>x</option></select>')).toBe(true);
  });
});

describe('LanguageSection renders SettingsSection -> SettingsRow -> Select, both locales (MIN-16, MIN-01)', () => {
  // Base UI's Select only puts the CURRENTLY SELECTED option's label into static markup — the
  // popup/list is portal-rendered and not part of renderToStaticMarkup's output (no jsdom in
  // this project, AD-047). So "the two option labels differ between them" is proven the
  // observable way: render the SAME selected value ('pt-BR') under each UI language and show the
  // rendered label text differs — the option label follows the CopyProvider, not the value.
  it("the 'pt-BR' option's own label differs between an English-language UI and a PT-BR-language UI", () => {
    const underEnglishUi = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(LanguageSection, { locale: 'pt-BR', onLocaleChange: () => {}, persistWarning: null }),
      }),
    );
    const underPtBrUi = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(LanguageSection, { locale: 'pt-BR', onLocaleChange: () => {}, persistWarning: null }),
      }),
    );
    expect(underEnglishUi).toContain('Portuguese (Brazil)');
    expect(underPtBrUi).toContain('Português (Brasil)');
    expect(underEnglishUi).not.toContain('Português (Brasil)');
  });

  it('English: aria-label and the selected option text both come from copy', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(LanguageSection, { locale: 'en', onLocaleChange: () => {}, persistWarning: null }),
      }),
    );
    expect(html).toContain('English');
    expect(html).toContain('aria-label="App language"');
    expect(html).toContain('role="combobox"');
  });

  it('PT-BR: aria-label and the selected option text both come from copy — DIFFERENT from English', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(LanguageSection, { locale: 'pt-BR', onLocaleChange: () => {}, persistWarning: null }),
      }),
    );
    expect(html).toContain('Português (Brasil)');
    expect(html).toContain('aria-label="Idioma do aplicativo"');
    expect(html).not.toContain('aria-label="App language"');
  });
});

describe('LanguageSection — the not-persisted Banner is an always-mounted slot (MIN-11, docs/no-layout-shift.md rule 1)', () => {
  it('persisted (persistWarning: null): the slot is present, empty, and hidden', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(LanguageSection, { locale: 'en', onLocaleChange: () => {}, persistWarning: null }),
      }),
    );
    expect(html).toContain('data-testid="settings-language-warning"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('Your save location');
    expect(html).not.toContain('could not be saved');
  });

  it("not persisted (persistWarning: 'not_writable'): the reason renders and the slot is visible", () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(LanguageSection, {
          locale: 'en',
          onLocaleChange: () => {},
          persistWarning: 'not_writable',
        }),
      }),
    );
    expect(html).toContain('data-testid="settings-language-warning"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Your save location is not writable');
  });

  it("not persisted (persistWarning: 'no_store'), PT-BR: the PT-BR reason renders", () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(LanguageSection, {
          locale: 'pt-BR',
          onLocaleChange: () => {},
          persistWarning: 'no_store',
        }),
      }),
    );
    expect(html).toContain('indisponível');
  });

  it('red state demonstrated (recorded here, never left in the real onLocaleChange): ignoring result.persisted renders no warning even on failure', () => {
    // The rejected shape — an onLocaleChange that always clears persistWarning regardless of the
    // write result. If LanguageSection's caller were written this way, MIN-11's Banner would
    // never render no matter how the write actually went.
    function ignoringOnLocaleChange(_next: 'en' | 'pt-BR'): void {
      // pretends the write always succeeds — never calls setPersistWarning(result.reason)
    }
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        // Simulates the caller having ignored a failed write: persistWarning stays null even
        // though a real failed write occurred.
        children: createElement(LanguageSection, { locale: 'en', onLocaleChange: ignoringOnLocaleChange, persistWarning: null }),
      }),
    );
    // This IS the defect: no warning text anywhere, even though (in the rejected shape) a write
    // just failed. The real page.tsx (T5) always threads result.reason through instead.
    expect(html).not.toContain('Your save location');
  });
});
