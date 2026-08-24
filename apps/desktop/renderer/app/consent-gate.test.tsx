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
