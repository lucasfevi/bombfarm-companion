import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { ForgeSection } from './forge-section';

function render(locale: 'en' | 'pt-BR', props: Partial<Parameters<typeof ForgeSection>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(ForgeSection, {
        forgeWritesEnabled: false,
        onForgeWritesEnabledChange: () => {},
        persistWarning: null,
        ...props,
      }),
    }),
  );
}

describe('ForgeSection source — zero bespoke controls of its own (docs/base-ui-first.md)', () => {
  const source = readFileSync(join(__dirname, 'forge-section.tsx'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('no <select>, <input>, <button> or <label> element literal', () => {
    expect(/<(select|input|button|label)\b/.test(stripped)).toBe(false);
  });
});

describe('ForgeSection renders SettingsSection -> SettingsRow -> Switch, both locales', () => {
  it('the label and the help differ between an English-language UI and a PT-BR-language UI', () => {
    const underEnglishUi = render('en');
    const underPtBrUi = render('pt-BR');
    expect(underEnglishUi).toContain('Let Forge spend gold');
    expect(underEnglishUi).toContain('Off: the Forge tab plans climbs and never rolls.');
    expect(underPtBrUi).toContain('Deixar a Forja gastar ouro');
    expect(underPtBrUi).toContain('Desligado: a aba Forja planeja subidas e nunca rola.');
    expect(underEnglishUi).not.toContain('Deixar a Forja gastar ouro');
  });

  it('English: aria-label and switch role both come from copy, and the switch is off by default', () => {
    const html = render('en');
    expect(html).toContain('aria-label="Let Forge spend gold"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
  });

  it('PT-BR: aria-label differs from English, and a true prop renders checked', () => {
    const html = render('pt-BR', { forgeWritesEnabled: true });
    expect(html).toContain('aria-label="Deixar a Forja gastar ouro"');
    expect(html).not.toContain('aria-label="Let Forge spend gold"');
    expect(html).toContain('aria-checked="true"');
  });
});

describe('ForgeSection — the not-persisted Banner is an always-mounted slot (docs/no-layout-shift.md rule 1)', () => {
  it('persisted (persistWarning: null): the slot is present, empty, and hidden', () => {
    const html = render('en');
    expect(html).toContain('data-testid="settings-forge-writes-warning"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('Your save location');
    expect(html).not.toContain('data-testid="settings-always-on-top-warning"');
  });

  it("not persisted (persistWarning: 'not_writable'): the reason renders and the slot is visible", () => {
    const html = render('en', { forgeWritesEnabled: true, persistWarning: 'not_writable' });
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Forge setting changed, but not saved');
    expect(html).toContain('Your save location is not writable');
  });

  it("not persisted (persistWarning: 'no_store'), PT-BR: the PT-BR title and reason render", () => {
    const html = render('pt-BR', { forgeWritesEnabled: true, persistWarning: 'no_store' });
    expect(html).toContain('Configuração da Forja alterada, mas não salva');
    expect(html).toContain('indisponível');
  });
});
