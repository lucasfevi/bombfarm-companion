import { describe, expect, it } from 'vitest';
import type { AppLocale } from '@bombfarm/contracts';
import { loopbackPage } from './loopback-page.js';

const EXPECTED = {
  en: {
    lang: 'en',
    title: 'Signed in — Bomb Farm Companion',
    heading: 'You are signed in',
    line: 'Return to the desktop app. You can close this tab.',
    caption: 'Back to the app',
  },
  'pt-BR': {
    lang: 'pt-BR',
    title: 'Conectado — Bomb Farm Companion',
    heading: 'Você está conectado',
    line: 'Volte para o app de desktop. Você pode fechar esta aba.',
    caption: 'De volta ao app',
  },
} as const;

const LOCALES: readonly AppLocale[] = ['en', 'pt-BR'];

describe.each(LOCALES)('the sign-in finished page in %s', (locale) => {
  const page = loopbackPage(locale);
  const other = EXPECTED[locale === 'en' ? 'pt-BR' : 'en'];
  const own = EXPECTED[locale];

  it('says its heading, line and step caption', () => {
    expect(page).toContain(`<h1>${own.heading}</h1>`);
    expect(page).toContain(`<p>${own.line}</p>`);
    expect(page).toContain(`<span class="caption">${own.caption}</span>`);
  });

  it('titles the tab and declares its language', () => {
    expect(page).toContain(`<title>${own.title}</title>`);
    expect(page).toContain(`<html lang="${own.lang}">`);
    expect(page.match(/lang="/g)).toHaveLength(1);
  });

  it('says nothing in the other language', () => {
    for (const sentence of [other.heading, other.line, other.caption, other.title]) {
      expect(page).not.toContain(sentence);
    }
    expect(page).not.toContain('<hr');
  });

  it('is static: no script, no link, no external resource', () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/href/i);
    expect(page).not.toMatch(/\bsrc\s*=/i);
    expect(page).not.toMatch(/https?:\/\//i);
  });

  it('declares UTF-8, styles itself inline and shows an inline check icon', () => {
    expect(page).toMatch(/<meta charset="utf-8">/);
    expect(page).toMatch(/<style>/);
    expect(page).toContain('<svg');
  });
});
