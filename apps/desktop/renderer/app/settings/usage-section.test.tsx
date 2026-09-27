import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { UsageSection } from './usage-section';

function render(locale: 'en' | 'pt-BR', props: Partial<Parameters<typeof UsageSection>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(UsageSection, {
        usagePingEnabled: true,
        onUsagePingEnabledChange: () => {},
        persistWarning: null,
        ...props,
      }),
    }),
  );
}

describe('UsageSection source — no controls of its own and no bridge', () => {
  const source = readFileSync(join(__dirname, 'usage-section.tsx'), 'utf8');

  it('no <select>, <input>, <button> or <label> element literal', () => {
    expect(/<(select|input|button|label)\b/.test(source)).toBe(false);
  });

  it('reaches for no bridge of its own — the page owns the write', () => {
    expect(source).not.toContain('window.bfc');
  });
});

describe('UsageSection copy says exactly what the ping carries, in both locales', () => {
  it('English names the code, the account id and the player name, and what switching off removes', () => {
    const html = render('en');
    expect(html).toContain('Include my account in the usage count');
    expect(html).toContain('a random code for this installation, your game account id and your player name');
    expect(html).toContain('only the app version — no code, no account, no name');
    expect(html).toContain('installation’s code is deleted');
    expect(html).toContain('On by default.');
  });

  it('PT-BR says the same, and neither locale leaks into the other', () => {
    const underPtBrUi = render('pt-BR');
    expect(underPtBrUi).toContain('Incluir minha conta na contagem de uso');
    expect(underPtBrUi).toContain('um código aleatório desta instalação, o id da sua conta do jogo e o seu nome de jogador');
    expect(underPtBrUi).toContain('só a versão do app — sem código, sem conta, sem nome');
    expect(underPtBrUi).toContain('Ligado por padrão.');
    expect(underPtBrUi).not.toContain('Include my account');
    expect(render('en')).not.toContain('Incluir minha conta');
  });

  it('the switch follows the stored value and is labelled from copy', () => {
    expect(render('en')).toContain('aria-checked="true"');
    expect(render('en', { usagePingEnabled: false })).toContain('aria-checked="false"');
    expect(render('en')).toContain('aria-label="Include my account in the usage count"');
  });
});

describe('UsageSection — the not-persisted Banner is an always-mounted slot', () => {
  it('persisted: the slot is present, empty and hidden', () => {
    const html = render('en');
    expect(html).toContain('data-testid="settings-usage-ping-warning"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('invisible');
  });

  it('not persisted: the reason renders and the slot is visible', () => {
    const html = render('en', { usagePingEnabled: false, persistWarning: 'not_writable' });
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Usage setting changed, but not saved');
    expect(html).toContain('Your save location is not writable, so this will not survive a restart.');
    expect(html).not.toContain('invisible');
  });
});

describe('UsageSection links to the published privacy policy', () => {
  it('opens the policy in the browser, labelled in each locale', () => {
    const en = render('en');
    expect(en).toContain('href="https://bombfarm-companion.app/privacy"');
    expect(en).toContain('target="_blank"');
    expect(en).toContain('Privacy policy');
    expect(render('pt-BR')).toContain('Política de privacidade');
  });
});
