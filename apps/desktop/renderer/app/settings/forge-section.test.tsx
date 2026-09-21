import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
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

// core's consent disclosure quotes these two labels byte-for-byte; a character's difference there
// is a guard failure this repo cannot see, so this pin holds the values themselves, not just that
// the component renders whatever copy says.
describe('the widened switch label matches what the consent disclosure quotes', () => {
  it('en', () => {
    expect(en.settingsForgeWritesLabel).toBe('Let the app forge, equip and reset points');
  });

  it('pt-BR', () => {
    expect(ptBR.settingsForgeWritesLabel).toBe('Deixar o app forjar, equipar e redistribuir pontos');
  });

  it('the section title is widened past the Forge tab alone', () => {
    expect(en.settingsForgeSectionTitle).toBe('Changes to your account');
  });
});

describe('ForgeSection renders SettingsSection -> SettingsRow -> Switch, both locales', () => {
  it('the label and the help differ between an English-language UI and a PT-BR-language UI', () => {
    const underEnglishUi = render('en');
    const underPtBrUi = render('pt-BR');
    expect(underEnglishUi).toContain(en.settingsForgeWritesLabel);
    expect(underEnglishUi).toContain('Off: the app plans and never changes your account.');
    expect(underPtBrUi).toContain(ptBR.settingsForgeWritesLabel);
    expect(underPtBrUi).toContain('Desligado: o app planeja e nunca altera sua conta.');
    expect(underEnglishUi).not.toContain(ptBR.settingsForgeWritesLabel);
  });

  it('English: aria-label and switch role both come from copy, and the switch is off by default', () => {
    const html = render('en');
    expect(html).toContain(`aria-label="${en.settingsForgeWritesLabel}"`);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
  });

  it('PT-BR: aria-label differs from English, and a true prop renders checked', () => {
    const html = render('pt-BR', { forgeWritesEnabled: true });
    expect(html).toContain(`aria-label="${ptBR.settingsForgeWritesLabel}"`);
    expect(html).not.toContain(`aria-label="${en.settingsForgeWritesLabel}"`);
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
