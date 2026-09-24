import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { USAGE_PING_ACCOUNT_FIELDS, USAGE_PING_FIELDS } from '@bombfarm/contracts';
import { PRIVACY_CONTACT_EMAIL, PrivacyPage } from '@/features/privacy';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: readonly Lang[] = ['en', 'pt'];
const render = (lang: Lang) => renderToStaticMarkup(createElement(PrivacyPage, { t: STRINGS[lang], lang }));
const asHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

describe('privacy page', () => {
  for (const lang of LANGS) {
    it(`${lang}: describes every field the desktop usage ping sends, the account's included`, () => {
      const html = render(lang);
      for (const field of USAGE_PING_FIELDS) {
        expect(html, field).toContain(`data-field="${field}"`);
        expect(html).toContain(asHtml(STRINGS[lang].privacyPingFields[field]));
      }
      for (const field of USAGE_PING_ACCOUNT_FIELDS) {
        expect(html, field).toContain(`data-field="account.${field}"`);
        expect(html).toContain(asHtml(STRINGS[lang].privacyPingAccountFields[field]));
      }
    });

    it(`${lang}: the contact address is a working mail link and no placeholder is left unfilled`, () => {
      const html = render(lang);
      expect(html).toContain(`href="mailto:${PRIVACY_CONTACT_EMAIL}"`);
      expect(html).not.toMatch(/\{(email|date)\}/);
    });
  }

  it('dates the policy in each language', () => {
    expect(render('en')).toContain('Last updated September 23, 2026');
    expect(render('pt')).toContain('Atualizada em 23 de setembro de 2026');
  });

  it('the two languages carry the same sections, paragraph for paragraph', () => {
    const shape = (lang: Lang) => STRINGS[lang].privacySections.map((section) => section.p.length);
    expect(shape('pt')).toEqual(shape('en'));
  });
});
