import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONSENT_TEXT_VERSION, initialConsent, type ConsentRecord } from '@bombfarm/game-api';
import { CopyProvider } from '../lib/copy';
import { ConsentGate, isConsentGateVisible } from './consent-gate';

const revoked: ConsentRecord = { decision: 'revoked', textVersion: CONSENT_TEXT_VERSION };
const declined: ConsentRecord = { decision: 'declined', textVersion: CONSENT_TEXT_VERSION };
const granted: ConsentRecord = {
  decision: 'granted',
  grantedAt: '2026-08-24T00:00:00.000Z',
  textVersion: CONSENT_TEXT_VERSION,
};
const grantedOnAnOldDisclosure: ConsentRecord = {
  decision: 'granted',
  grantedAt: '2026-08-24T00:00:00.000Z',
  textVersion: CONSENT_TEXT_VERSION - 1,
};

describe('isConsentGateVisible — not before the consent record has loaded', () => {
  it('stays hidden while the record is still null', () => {
    expect(isConsentGateVisible(null)).toBe(false);
  });
});

describe('isConsentGateVisible — does not appear for a current valid grant', () => {
  it('a fully granted, current record stays hidden', () => {
    expect(isConsentGateVisible(granted)).toBe(false);
  });
});

describe('isConsentGateVisible — appears whenever isGranted would reject the record', () => {
  it('an unasked record gates', () => {
    expect(isConsentGateVisible(initialConsent())).toBe(true);
  });

  it('a declined record gates', () => {
    expect(isConsentGateVisible(declined)).toBe(true);
  });

  it('a revoked record gates', () => {
    expect(isConsentGateVisible(revoked)).toBe(true);
  });

  it('a grant made against an older disclosure version still gates', () => {
    expect(isConsentGateVisible(grantedOnAnOldDisclosure)).toBe(true);
  });
});

describe('ConsentGate — renders in both languages', () => {
  function render(locale: 'en' | 'pt-BR') {
    return renderToStaticMarkup(
      createElement(CopyProvider, {
        locale,
        children: createElement(ConsentGate, {
          locale,
          onLocaleChange: () => {},
          onReadAgain: () => {},
        }),
      }),
    );
  }

  it('English', () => {
    const html = render('en');
    expect(html).toContain('data-testid="consent-gate"');
    expect(html).toContain('This app needs your permission to work');
    expect(html).toContain('Read the disclosure again');
    expect(html).toContain('aria-label="Language"');
  });

  it('PT-BR — different text from English', () => {
    const html = render('pt-BR');
    expect(html).toContain('Este app precisa da sua permissão para funcionar');
    expect(html).toContain('Ler o aviso novamente');
    expect(html).toContain('aria-label="Idioma"');
    expect(html).not.toContain('This app needs your permission to work');
  });
});

/**
 * The language row widens its control column past `SettingsRow`'s default stack width
 * (`[&_label_[data-select]]:w-[96px]`, sized for short values like rank numbers) — 96px clips
 * "Português (Brasil)" mid-word. `cn()`/`tailwind-merge` is what makes the override in
 * `consent-gate.tsx`'s `SettingsRow` `className` win: both classes target the same
 * `[data-select]` width, so if the merge did not resolve the conflict, the narrower class would
 * still be present alongside the wider one. The `[data-num]` sibling selector's own `w-[96px]`
 * (a different control, untouched by this row) is expected to remain, which is why the assertion
 * below is scoped to the `[data-select]` selector rather than a bare `w-[96px]` substring. This
 * proves the emitted `class` attribute (`renderToStaticMarkup` does render it, since
 * `SettingsRow`/`Select`'s trigger is never inside a `Dialog.Portal`) carries only the wide
 * override — it does not prove the text visually fits in the trigger at any given window size.
 */
describe('ConsentGate — the language row overrides SettingsRow’s default 96px control width', () => {
  it('the wide override class reaches the DOM and the narrow [data-select] default is gone', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'pt-BR',
        children: createElement(ConsentGate, {
          locale: 'pt-BR',
          onLocaleChange: () => {},
          onReadAgain: () => {},
        }),
      }),
    );
    expect(html).toContain('[data-select]]:w-56');
    expect(html).not.toContain('[data-select]]:w-[96px]');
    // The sibling `[data-num]` control-column width is a different control, untouched by this
    // row's override, and expected to still carry the default.
    expect(html).toContain('[data-num]]:w-[96px]');
  });
});
