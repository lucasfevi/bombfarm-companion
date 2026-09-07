import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { GameSection } from './game-section';

function render(locale: 'en' | 'pt-BR', props: Partial<Parameters<typeof GameSection>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(GameSection, {
        restartGameOnExit: false,
        onRestartGameOnExitChange: () => {},
        persistWarning: null,
        ...props,
      }),
    }),
  );
}

describe('GameSection source — no controls of its own and no account access (docs/base-ui-first.md)', () => {
  const source = readFileSync(join(__dirname, 'game-section.tsx'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('no <select>, <input>, <button> or <label> element literal', () => {
    expect(/<(select|input|button|label)\b/.test(stripped)).toBe(false);
  });

  it('reaches for no bridge of its own — the page owns the write', () => {
    expect(source).not.toContain('window.bfc');
  });
});

describe('GameSection renders SettingsSection -> SettingsRow -> Switch, both locales', () => {
  it('the title, the label and the help differ between an English-language UI and a PT-BR-language UI', () => {
    const underEnglishUi = render('en');
    const underPtBrUi = render('pt-BR');

    expect(underEnglishUi).toContain('Restart Bomb Farm if it exits');
    expect(underEnglishUi).toContain(
      'When this is on, if the game closes while the companion is already running, Steam starts it again.',
    );
    expect(underPtBrUi).toContain('Reiniciar o Bomb Farm se ele fechar');
    expect(underPtBrUi).toContain('Com isto ligado, se o jogo fechar enquanto o companion já está aberto');
    expect(underEnglishUi).not.toContain('Reiniciar o Bomb Farm se ele fechar');
    expect(underPtBrUi).not.toContain('Restart Bomb Farm if it exits');
  });

  it('English: aria-label and switch role both come from copy, and the switch is off by default', () => {
    const html = render('en');
    expect(html).toContain('aria-label="Restart Bomb Farm if it exits"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
  });

  it('a true prop renders checked, so the control follows what was stored', () => {
    const html = render('en', { restartGameOnExit: true });
    expect(html).toContain('aria-checked="true"');
  });
});

describe('GameSection — the not-persisted Banner is an always-mounted slot (docs/no-layout-shift.md rule 1)', () => {
  it('persisted (persistWarning: null): the slot is present, empty, and hidden', () => {
    const html = render('en');
    expect(html).toContain('data-testid="settings-restart-game-on-exit-warning"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('invisible');
    expect(html).not.toContain('Your save location');
  });

  it("not persisted (persistWarning: 'not_writable'): the reason renders and the slot is visible", () => {
    const html = render('en', { restartGameOnExit: true, persistWarning: 'not_writable' });
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Game setting changed, but not saved');
    expect(html).toContain('Your save location is not writable, so this will not survive a restart.');
    expect(html).not.toContain('invisible');
  });

  it("not persisted (persistWarning: 'no_store'), PT-BR: the PT-BR title and reason render", () => {
    const html = render('pt-BR', { restartGameOnExit: true, persistWarning: 'no_store' });
    expect(html).toContain('Configuração do jogo alterada, mas não salva');
    expect(html).toContain('indisponível');
  });
});
