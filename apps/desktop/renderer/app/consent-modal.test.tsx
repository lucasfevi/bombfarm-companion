import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONSENT_TEXT_VERSION, consentTextFor, initialConsent, type ConsentRecord } from '@bombfarm/game-api';
import { ConsentClauseList, isConsentModalVisible } from './consent-modal';

const revoked: ConsentRecord = { decision: 'revoked', textVersion: CONSENT_TEXT_VERSION };
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

describe('isConsentModalVisible — does not appear on its own for a record that should not trigger it', () => {
  it('a revoked record stays hidden without forceOpen', () => {
    expect(isConsentModalVisible(revoked, false)).toBe(false);
  });

  it('a current, fully granted record stays hidden without forceOpen', () => {
    expect(isConsentModalVisible(granted, false)).toBe(false);
  });
});

describe('isConsentModalVisible — appears when forced open, for a record that would otherwise stay hidden', () => {
  it('a revoked record appears once forced open', () => {
    expect(isConsentModalVisible(revoked, true)).toBe(true);
  });

  it('a current, fully granted record appears once forced open (the settings re-allow path)', () => {
    expect(isConsentModalVisible(granted, true)).toBe(true);
  });
});

describe('isConsentModalVisible — unchanged existing behaviour', () => {
  it('an unasked record appears on its own, forceOpen or not', () => {
    expect(isConsentModalVisible(initialConsent(), false)).toBe(true);
    expect(isConsentModalVisible(initialConsent(), true)).toBe(true);
  });

  it('a grant that predates the current disclosure version re-prompts on its own', () => {
    expect(isConsentModalVisible(grantedOnAnOldDisclosure, false)).toBe(true);
  });

  it('never appears before the record has loaded, even when forced open', () => {
    expect(isConsentModalVisible(null, true)).toBe(false);
  });
});

/**
 * `ConsentClauseList` is rendered standalone (not nested in `Dialog.Portal`, the real dialog's
 * shell) precisely so this is possible — everything under a Base UI `Dialog.Portal` is skipped by
 * `renderToStaticMarkup` (no jsdom in this project), so a heading/text assertion against
 * `ConsentModalDialog` itself would see an empty string no matter what it renders.
 */
describe('ConsentClauseList — every clause heading and its text reach the output', () => {
  it('English: all five headings and sentences appear, and none of the PT-BR text does', () => {
    const en = consentTextFor('en');
    const html = renderToStaticMarkup(createElement(ConsentClauseList, { body: en.body }));
    expect(en.body).toHaveLength(5);
    for (const clause of en.body) {
      expect(html).toContain(clause.heading);
      // renderToStaticMarkup HTML-escapes apostrophes ("game's" -> "game&#x27;s").
      expect(html).toContain(clause.text.replace(/'/g, '&#x27;'));
    }
    const [firstPtBrClause] = consentTextFor('pt-BR').body;
    expect(firstPtBrClause).toBeDefined();
    expect(html).not.toContain(firstPtBrClause?.heading);
  });

  it('PT-BR: all five headings and sentences appear, and none of the English text does', () => {
    const ptBr = consentTextFor('pt-BR');
    const html = renderToStaticMarkup(createElement(ConsentClauseList, { body: ptBr.body }));
    expect(ptBr.body).toHaveLength(5);
    for (const clause of ptBr.body) {
      expect(html).toContain(clause.heading);
      expect(html).toContain(clause.text);
    }
    const [firstEnClause] = consentTextFor('en').body;
    expect(firstEnClause).toBeDefined();
    expect(html).not.toContain(firstEnClause?.heading);
  });

  it('the clause list is its own scroll container, independent of the dialog shell', () => {
    const html = renderToStaticMarkup(
      createElement(ConsentClauseList, { body: consentTextFor('en').body }),
    );
    expect(html).toContain('data-testid="consent-modal-body"');
    expect(html).toContain('overflow-y-auto');
  });
});
